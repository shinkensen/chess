import { PieceCoords } from "../page";

export type MoveResult = {
    gameState: string[][];
    pieceCoordinates: PieceCoords;
};

export function moveKnight(reRender:(gameState:string[][],x1:number,y1:number,x2:number,y2:number,pieceCoordinates:PieceCoords)=>MoveResult,gameState:string[][], x1:number,y1:number,x2:number, y2 :number,pieceCoordinates:PieceCoords): [MoveResult | null, boolean]{
    if (canMoveKnight(gameState,x1,y1,x2,y2)){
        const ret = reRender(gameState,x1,y1,x2,y2,pieceCoordinates);
        return [ret,true];
    }
    return [null,false];
}
function canMoveKnight(gameState:string[][], x1:number, y1:number,x2:number,y2:number){
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);

    if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)){
        if (gameState[x1][y1] !== "" && gameState[x2][y2] !== gameState[x1][y1]){
            return true;
        }
    }
    return false;
}
