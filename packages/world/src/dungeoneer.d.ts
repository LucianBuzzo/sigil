declare module "dungeoneer" {
  type TileType = "wall" | "floor" | "door";

  interface PlainTile {
    x: number;
    y: number;
    type: TileType;
    region?: number;
    regionId?: number;
    regionTag?: string;
  }

  interface BuildOutput {
    tiles: PlainTile[][];
    toJS: () => {
      tiles: PlainTile[][];
      rooms: unknown[];
    };
  }

  interface BuildOptions {
    width: number;
    height: number;
    seed?: string | number;
    constraints?: {
      minRooms?: number;
      maxRooms?: number;
      minRoomSize?: number;
      maxRoomSize?: number;
    };
  }

  const dungeoneer: {
    build: (options: BuildOptions) => BuildOutput;
  };

  export = dungeoneer;
}
