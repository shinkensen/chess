"use client";

import { useEffect, useState } from 'react';
import {Board} from './components/Board'
import { moveKnight } from './components/Game';

export default function Home(){
  const [pieceCoordinates, setPieceCoordinates] = useState({
    KnightBlack : [[0,0],[1,1]],
    KnightWhite: [[3,2],[4,0]]
  });
  const [state, setState] = useState(() => buildState(pieceCoordinates));
  const move = (x1:number,y1:number,x2:number, y2:number)=>{

      const r = moveKnight(reRender, state, x1,y1,x2,y2,pieceCoordinates);
      console.log(r[1]);
      console.log(r[0]);

      if (r[1] && r[0]) {
       setState(r[0].gameState);
        setPieceCoordinates(r[0].pieceCoordinates);
      }
      return;
    return 0;
  }

  return (<Board gameState={state} move = {move}>

  </Board>)
}
export type PieceCoords = {KnightBlack:number[][],KnightWhite:number[][]};
function coordinateEquals(coords: number[][],x:number,y:number){
  let ret = false;
  coords.forEach(element => {
    if (element[0] ==x && element[1] ==y){
      ret = true;
    }
  });
  return ret;
}
const reRender = (gameState:string[][],x1:number,y1:number,x2:number,y2:number,pieceCoordinates:PieceCoords) =>{
  const nextGameState = gameState.map(row => [...row]);
  const nextPieceCoordinates: PieceCoords = {
    KnightBlack: pieceCoordinates.KnightBlack.map(coords => [...coords]),
    KnightWhite: pieceCoordinates.KnightWhite.map(coords => [...coords]),
  };

  const pieceType = nextGameState[x1][y1];
  if (pieceType == "NB"){
    let idx =0;
    nextPieceCoordinates.KnightBlack.forEach(value=>{
      if (value[0] == x1 && value[1] ==y1){
        nextPieceCoordinates.KnightBlack[idx] = [x2,y2];
      }
      idx++;
    })
    nextGameState[x2][y2] = nextGameState[x1][y1];
    nextGameState[x1][y1] = "";
  }
  if (pieceType == "NW"){
    let idx =0;
    nextPieceCoordinates.KnightWhite.forEach(value=>{
      if (value[0] == x1 && value[1] ==y1){
        nextPieceCoordinates.KnightWhite[idx] = [x2,y2];
      }
      idx++;
    })
    nextGameState[x2][y2] = nextGameState[x1][y1];
    nextGameState[x1][y1] = "";
  }
  /*
  when you are checking back on this tmrw, just finish the movmement and debug tf out of it until it works, add a "selector" aspect!
  bye! 2:15pm Sunday May 24th checkout
  */



  return {gameState: nextGameState, pieceCoordinates: nextPieceCoordinates}
}
const buildState = (pieceCoordinates:PieceCoords)=>{
  let state= [];
  for (let  i=0;i<8;i++){
    let temp =[];
    for (let j=0;j<8;j++){
      if (coordinateEquals(pieceCoordinates.KnightBlack,i,j)){
        temp.push("NB")
      }
      else if (coordinateEquals(pieceCoordinates.KnightWhite,i,j)){
        temp.push("NW");
      }
      else{
        temp.push("");
      }
    }
    state.push(temp);
  }
  return state;
}