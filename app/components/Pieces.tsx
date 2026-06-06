

export function Knight({ white }: { white:boolean}) {
  return (
    <span style={{ fontSize: "2rem", lineHeight: 1 }}>
      {!white ? "♘" : "♞"}
    </span>
  );
}