"use client";
import { useEffect, useState } from "react";
import { Square } from "./Square";
import { Knight } from "./Pieces";
export  const Board = ({gameState,move}:{gameState:string[][],move:(x1:number,y1:number,x2:number, y2:number)=>{}}) => {
    const [selectedCoords,setSelectedCoords] = useState([-1,-1]);
    const [pieceCoords,setPieceCoords] = useState([-1,-1]);
    function renderSquare(i:number,value:string,prevValue:boolean){
        const col = i % 8;
        const row = Math.trunc(i / 8);
        const isSelected = selectedCoords[0] === row && selectedCoords[1] === col;
        let doSelect = () => setSelectedCoords([row, col]);


        let piece = null;
        if (value!= ""){
            if (value=== "NW"){
                piece = (<Knight white  = {true}></Knight>)
            }
            if (value === "NB"){
                piece = (<Knight white = {false}></Knight>)
            }
            doSelect = () => {
                setPieceCoords([row, col]);
                console.log("Hi, the piece Coords are ", col, " and ",row);
            }
        }

        if (!piece){
            return(<div key={i} style={{ width: '100%', height: '100%' }}>
                <Square green = {prevValue} selected={isSelected} onSelect={doSelect}></Square>
            </div>);
        }
        else{
            return (<div key={i} style={{ width: '100%', height: '100%' }}>
                <Square green = {prevValue} selected={isSelected} onSelect={doSelect}>{piece}</Square>
            </div>);
        }
    }
    useEffect(() => {
        if (selectedCoords[0] !== -1 && pieceCoords[0] !== -1){
            move(pieceCoords[0],pieceCoords[1],selectedCoords[0],selectedCoords[1]);
            setPieceCoords(selectedCoords);
            setSelectedCoords([-1,-1]);
        }
    }, [move, pieceCoords, selectedCoords]);
    let prevValue = true;
  let ret:React.ReactNode[] = [];
    let counter = 0;
    for (let i =0;i<8;i++){
        for (let j=0;j<8;j++){
            ret.push(renderSquare(counter, gameState[i][j],prevValue));
            prevValue = !prevValue;
            
            counter++;

        }
        prevValue = !prevValue;
    }
    let fin  = (<div style={{
        width: '400px',
        aspectRatio: '1 / 1',
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
      }}>{ret}</div>)
  return fin;
}
