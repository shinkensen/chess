"use client";
import type { CSSProperties } from "react";

export const Square =({green,selected,children,onSelect}:{green:boolean,selected:boolean,children?:React.ReactNode,onSelect:()=>void})=>{
    const fill = green ? "black" : "red";
    const selectedFill = green ? "rgb(100,100,100)" : "rgb(255,130,130)";
    const styleChoices: CSSProperties = {
        backgroundColor: selected ? selectedFill : fill,
        width: "100%",
        height: "100%",
        border: "1px solid white",
        textAlign: "center",
        alignContent: "center"
    };
    return (
    <div style={styleChoices} onClick={onSelect}>
        {children}
    </div>
    )
}