/* eslint-disable func-style */
const config = {
  type: Phaser.AUTO,
  width: 1500,
  height: 1024,
  physics: {
    default: "arcade",
    arcade: { debug: SVGComponentTransferFunctionElement }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const players = [];
const game = new Phaser.Game(config);

let up;
let left;
let right;
let down;
let space;

function preload() {
  this.load.image("white", "assets/characters/white.png");
  this.load.audio({
    key: "gamemusic",
    url: "assets/audio/music.mp3",
    config: {
      loop: true
    }
  });

  this.load.tilemapTiledJSON("map1", "assets/maps/map1.json");
  this.load.image("floor", "assets/maps/floor.png");
  this.load.spritesheet("blocks", "assets/maps/blocks.png", { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet("chest", "assets/maps/chests.png", { frameWidth: 64, frameHeight: 64 });

  this.load.spritesheet({
    key: "bomb",
    url: "assets/bombs/bomb.png",
    frameConfig: {
      frameWidth: 46,
      frameHeight: 46,
      startFrame: 0,
      endFrame: 1
    }
  });
  this.load.spritesheet({
    key: "explosion",
    url: "assets/bombs/explosion.png",
    frameConfig: {
      frameWidth: 64,
      frameHeight: 64,
      startFrame: 0,
      endFrame: 16
    }
  });
}

//calculates the center of the tile player is standing on
const calculateCenterTileXY = playerLocation => {
  return 32 - (playerLocation % 64) + playerLocation;
};

function create() {
  this.socket = io("/game");
  const music = this.sound.add("gamemusic");
  music.loop = true;
  // music.play();

  this.map = this.add.tilemap("map1");

  let floorSet = this.map.addTilesetImage("floor", "floor");

  this.blocksLayer = this.map.createStaticLayer("floor", floorSet);

  this.player = this.physics.add.sprite(96, 96, "white").setSize(64, 64);

  this.chest = this.map.createFromObjects("chest", 41, { key: "chest" });
  const chest = this.physics.add.group(this.chest);
  this.physics.world.enable(chest);
  this.physics.add.collider(this.player, chest);
  this.chest.forEach(c => c.body.setSize(55, 55).setImmovable());

  this.wall = this.map.createFromObjects("chest", 1, { key: "blocks" });
  const wall = this.physics.add.group(this.wall);
  this.physics.world.enable(wall);
  this.physics.add.collider(this.player, wall);
  this.wall.forEach(c => c.body.setSize(55, 55).setImmovable());

  this.chestMap = {};
  for (let chest of this.chest) {
    const x = (chest.x - 32) / 64;
    const y = (chest.y - 32) / 64;

    this.chestMap[`${x},${y}`] = chest;
  }
  console.log(this.chestMap);

  this.wallMap = {};
  for (let wall of this.wall) {
    const x = (wall.x - 32) / 64;
    const y = (wall.y - 32) / 64;

    this.wallMap[`${x},${y}`] = wall;
  }

  //collision for world bounds
  this.player.setCollideWorldBounds(true);

  this.physics.add.collider(this.player, this.blocksLayer);

  up = this.input.keyboard.addKey("W");
  left = this.input.keyboard.addKey("A");
  right = this.input.keyboard.addKey("D");
  down = this.input.keyboard.addKey("S");
  space = this.input.keyboard.addKey("SPACE");

  //bomb animation
  this.anims.create({
    key: "boom",
    frames: this.anims.generateFrameNumbers("bomb", { start: 0, end: 1 }),
    frameRate: 3,
    repeat: 3
  });

  //explosion animation
  this.anims.create({
    key: "fire",
    frames: this.anims.generateFrameNumbers("explosion", { start: 0, end: 16 }),
    frameRate: 30,
    repeat: 0
  });
  const movePlayer = data => {
    //down
    if ((data.angle >= 0 && data.angle < 22.5) || (data.angle < 359 && data.angle > 337.5)) {
      this.player[data.playerId].body.setVelocityY(200);
      //right/down
    } else if (data.angle >= 22.5 && data.angle < 67.5) {
      this.player[data.playerId].body.setVelocityX(200);
      this.player[data.playerId].body.setVelocityY(200);

      //right
    } else if (data.angle >= 67.5 && data.angle < 112.5) {
      this.player[data.playerId].body.setVelocityX(200);
      //right/up
    } else if (data.angle >= 112.5 && data.angle < 157.5) {
      this.player[data.playerId].body.setVelocityX(200);
      this.player[data.playerId].body.setVelocityY(-200);

      //up
    } else if (data.angle >= 157.5 && data.angle < 202.5) {
      this.player[data.playerId].body.setVelocityY(-200);

      //up/left
    } else if (data.angle >= 202.5 && data.angle < 247.5) {
      this.player[data.playerId].body.setVelocityX(-200);
      this.player[data.playerId].body.setVelocityY(-200);

      //left
    } else if (data.angle >= 247.5 && data.angle < 292.5) {
      this.player[data.playerId].body.setVelocityX(-200);

      //down/left
    } else if (data.angle >= 292.5 && data.angle < 337.5) {
      this.player[data.playerId].body.setVelocityX(-200);
      this.player[data.playerId].body.setVelocityY(200);
    }
  };

  this.socket.on("playerMovement", data => {
    movePlayer(data);
  });

  // Stop any previous movement from the last frame
  this.socket.on("playerMovementEnd", data => {
    console.log(data);
    this.player[data.playerId].body.setVelocity(0);
  });

  this.socket.on("dropBomb", data => {
    console.log(data);
    if (this.player[data.playerId].body) {
      this.bomb = this.physics.add
        .sprite(
          calculateCenterTileXY(this.player[data.playerId].x),
          calculateCenterTileXY(this.player[data.playerId].y),
          "bomb"
        )
        .setImmovable()
        .setSize(64, 64);
      // .setOrigin(0.5, 0.5);
      this.physics.add.collider(this.player[data.playerId], this.bomb);

      this.bomb.play("boom", true);

      let bomb = this.bomb;

      //destory bomb after detonation animations
      this.bomb.once(Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE, () => {
        bomb.destroy();

        //bomb power level
        let bombPower = 2;

        //directions for bombs to spread
        const explosionDirection = [
          { x: 0, y: 0 },
          { x: 0, y: -1 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: -1, y: 0 }
        ];

        //checks overlaps with game objects and explosions
        function checkOverlap(gameObject, explosion) {
          if (!gameObject) {
            return false;
          }
          var boundsA = gameObject.getBounds();
          var boundsB = explosion.getBounds();
          return Phaser.Geom.Rectangle.Overlaps(boundsA, boundsB);
        }

        for (const direction of explosionDirection) {
          for (let blastLength = 0; blastLength <= bombPower; blastLength++) {
            const bombX = bomb.x + direction.x * blastLength * 64;
            const bombY = bomb.y + direction.y * blastLength * 64;

            let explosion = this.physics.add.sprite(bombX, bombY, "fire").setImmovable();

            for (const player of players) {
              if (checkOverlap(this.player[player], explosion)) {
                this.player[player].destroy();
              }
            }

            //break if explosion collides with walls
            if (checkOverlap(this.wallMap[`${(bombX - 32) / 64},${(bombY - 32) / 64}`], explosion)) {
              explosion.destroy();
              break;
            }

            //plays explosion animation
            explosion.play("fire", true);

            //clears the explosion after animation is complete
            explosion.once(Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE, () => {
              explosion.destroy();
            });

            //checks for explosion-chest overlap and destorys chest
            if (checkOverlap(this.chestMap[`${(bombX - 32) / 64},${(bombY - 32) / 64}`], explosion)) {
              this.chestMap[`${(bombX - 32) / 64},${(bombY - 32) / 64}`].destroy();
              delete this.chestMap[`${(bombX - 32) / 64},${(bombY - 32) / 64}`];
              break;
            }
          }
        }
      });
    }
  });

  this.socket.on("newPlayer", data => {
    console.log(data);
    players.push(data.playerId);
    this.player[data.playerId] = this.physics.add.sprite(data.spawnx, data.spawny, "white").setSize(64, 64);
    this.player[data.playerId].setCollideWorldBounds(true);
    this.player[data.playerId].depth = 1;

    this.physics.add.collider(this.player[data.playerId], chest);
    this.physics.add.collider(this.player[data.playerId], wall);
  });

  this.socket.on("disconnect", data => {
    console.log("player leaving");
    this.player[data].destroy();
  });
}

const speed = 200;

function update() {
  //makes sure there is a player to execute movement
  if (this.player.body) {
    this.player.body.setVelocity(0);

    // Horizontal movement
    if (this.input.keyboard.checkDown(left, 0)) {
      this.player.body.setVelocityX(-200);
    } else if (this.input.keyboard.checkDown(right, 0)) {
      this.player.body.setVelocityX(200);
    }
    // Vertical movement
    if (this.input.keyboard.checkDown(up, 0)) {
      this.player.body.setVelocityY(-200);
    } else if (this.input.keyboard.checkDown(down, 0)) {
      this.player.body.setVelocityY(200);
    }

    // Normalize and scale the velocity so that player can't move faster along a diagonal
    this.player.body.velocity.normalize().scale(speed);

    //makes sure players displays above bomb
    this.player.depth = 1;
  }

  if (this.player.body) {
    // Spawning Bomb
    if (this.input.keyboard.checkDown(space, 99999)) {
      this.bomb = this.physics.add
        .sprite(calculateCenterTileXY(this.player.x), calculateCenterTileXY(this.player.y), "bomb")
        .setImmovable()
        .setSize(64, 64);

      this.physics.add.collider(this.player, this.bomb);
      this.bomb.play("boom", true);

      let bomb = this.bomb;

      //destory bomb after detonation animations
      this.bomb.once(Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE, () => {
        bomb.destroy();

        //bomb power level
        let bombPower = 2;

        //directions for bombs to spread
        const explosionDirection = [
          { x: 0, y: 0 },
          { x: 0, y: -1 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: -1, y: 0 }
        ];

        //checks overlaps with game objects and explosions
        function checkOverlap(gameObject, explosion) {
          if (!gameObject) {
            return false;
          }
          var boundsA = gameObject.getBounds();
          var boundsB = explosion.getBounds();
          return Phaser.Geom.Rectangle.Overlaps(boundsA, boundsB);
        }

        for (const direction of explosionDirection) {
          for (let blastLength = 0; blastLength <= bombPower; blastLength++) {
            const bombX = bomb.x + direction.x * blastLength * 64;
            const bombY = bomb.y + direction.y * blastLength * 64;

            let explosion = this.physics.add.sprite(bombX, bombY, "fire").setImmovable();

            if (checkOverlap(this.player, explosion)) {
              this.player.destroy();
            }
            //break if explosion collides with walls
            if (checkOverlap(this.wallMap[`${(bombX - 32) / 64},${(bombY - 32) / 64}`], explosion)) {
              explosion.destroy();
              break;
            }

            //plays explosion animation
            explosion.play("fire", true);

            //clears the explosion after animation is complete
            explosion.once(Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE, () => {
              explosion.destroy();
            });

            //checks for explosion-chest overlap and destorys chest
            if (checkOverlap(this.chestMap[`${(bombX - 32) / 64},${(bombY - 32) / 64}`], explosion)) {
              this.chestMap[`${(bombX - 32) / 64},${(bombY - 32) / 64}`].destroy();
              delete this.chestMap[`${(bombX - 32) / 64},${(bombY - 32) / 64}`];
              break;
            }
          }
        }
      });
    }
  }
}
