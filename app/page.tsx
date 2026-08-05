"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InGame } from "./components/InGame";
import { HomeScreen } from "./components/HomeScreen";

function Router() {
  const params = useSearchParams();
  const gameId = params.get("gameId");
  return (
    <div>
      {gameId ? (
        <InGame gameId={gameId} />
      ) : (
        <Suspense fallback={null}>
          <HomeScreen />
        </Suspense>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Router />
    </Suspense>
  );
}