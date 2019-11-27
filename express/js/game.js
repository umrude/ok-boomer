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

function create() {
  this.socket = io("/game");
  const music = this.sound.add("gamemusic");
  music.loop = true;
  // music.play();

  this.map = this.add.tilemap("map1");

  // let blockSet = this.map.addTilesetImage("blocks", "blocks");
  let floorSet = this.map.addTilesetImage("floor", "floor");
  // let chestSet = this.map.addTilesetImage("chests", "chests");

  this.blocksLayer = this.map.createStaticLayer("floor", floorSet);
  // this.blocksLayer.setCollisionByProperty({ collides: true });
  // this.chestLayer = this.map.createDynamicLayer("chest", [chestSet], 0, 0);

  this.player = this.physics.add.sprite(96, 96, "white").setSize(64, 64);
  this.chest = this.map.createFromObjects("chest", 41, { key: "chest" });
  this.wall = this.map.createFromObjects("chest", 1, { key: "blocks" });

  this.chestMap = {};
  for (let chest of this.chest) {
    const x = chest.x / 64;
    const y = chest.y / 64;

    this.chestMap[`${x},${y}`] = chest;
  }

  this.wallMap = {};
  for (let wall of this.wall) {
    const x = (wall.x - 32) / 64;
    const y = (wall.y - 32) / 64;

    this.wallMap[`${x},${y}`] = wall;
  }
  console.log(this.wallMap);

  //collision for world bounds
  this.player.setCollideWorldBounds(true);

  this.physics.add.collider(this.player, this.blocksLayer);

  const chest = this.physics.add.group(this.chest);
  this.physics.world.enable(chest);
  this.physics.add.collider(this.player, chest);
  this.chest.forEach(c => c.body.setSize(55, 55).setImmovable());

  const wall = this.physics.add.group(this.wall);
  this.physics.world.enable(wall);
  this.physics.add.collider(this.player, wall);
  this.wall.forEach(c => c.body.setSize(55, 55).setImmovable());

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
    repeat: 2
  });

  //explosion animation
  this.anims.create({
    key: "fire",
    frames: this.anims.generateFrameNumbers("explosion", { start: 0, end: 16 }),
    frameRate: 30,
    repeat: 0
  });

  const movePlayer = dir => {
    this.player.body.setVelocity(0);

    if (dir === "Left") {
      this.player.body.setVelocityX(-200);
    } else if (dir === "Right") {
      this.player.body.setVelocityX(200);
    } else if (dir === "Up") {
      this.player.body.setVelocityY(-200);
    } else if (dir === "Down") {
      this.player.body.setVelocityY(200);
    }
  };

  this.socket.on("playerMovement", data => {
    console.log(data);
    movePlayer(data.move);
  });

  // Stop any previous movement from the last frame
  this.socket.on("playerMovementEnd", data => {
    this.player.body.setVelocity(0);
  });

  this.socket.on("dropBomb", data => {
    console.log(data);
  });
  console.log(this.blocksLayer);
  // console.log(this.blocksLayer.getTileAt(1, 0));
}

const speed = 200;
function update() {
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

  //calculates the center of the tile player is standing on
  const calculateCenterTileXY = playerLocation => {
    return 32 - (playerLocation % 64) + playerLocation;
  };
  // Spawning Bomb
  if (this.input.keyboard.checkDown(space, 99999)) {
    this.bomb = this.physics.add
      .sprite(calculateCenterTileXY(this.player.x), calculateCenterTileXY(this.player.y), "bomb")
      .setImmovable()
      .setSize(64, 64);
    // .setOrigin(0.5, 0.5);

    this.bomb.play("boom", true);

    let bomb = this.bomb;

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
        let hitChest = false;
        for (let blastLength = 0; blastLength <= bombPower; blastLength++) {
          //break if explosion hits chest
          if (hitChest) {
            break;
          }
          const bombX = bomb.x + direction.x * blastLength * 64;
          const bombY = bomb.y + direction.y * blastLength * 64;

          let explosion = this.physics.add.sprite(bombX, bombY, "fire").setImmovable();

          //break if explosion collides with walls
          if (checkOverlap(this.wallMap[`${(bombX - 32) / 64},${(bombY - 32) / 64}`], explosion)) {
            explosion.destroy();
            break;
          }

          for (let chest of this.chest) {
            if (checkOverlap(chest, explosion)) {
              chest.destroy();
              this.chest = this.chest.filter(c => {
                return chest !== c;
              });
              hitChest = true;
              break;
            }
          }

          //plays explosion animation
          explosion.play("fire", true);
          explosion.once(Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE, () => {
            explosion.destroy();
          });
        }
      }
    });

    this.physics.add.collider(this.player, this.bomb);
  }
}
