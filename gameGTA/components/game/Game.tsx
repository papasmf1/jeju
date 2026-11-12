"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { GameEngine, type HudState } from "@/lib/game/engine";

const initialHud: HudState = {
  speed: 0,
  health: 100,
  money: 0,
  deliveries: 0,
  wanted: 0,
  missionTitle: "",
  missionDetail: "",
  timeLeft: null,
  distance: 0,
  status: "playing",
  message: "",
};

const won = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

const CONTROLS: [string, string][] = [
  ["W / ↑", "가속"],
  ["S / ↓", "브레이크 · 후진"],
  ["A D / ← →", "핸들"],
  ["Space", "핸드브레이크 (드리프트)"],
  ["Esc / P", "일시정지"],
];

const panel = "border-white/10 bg-black/60 text-white backdrop-blur-md";

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudState>(initialHud);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !mapRef.current) return;
    const engine = new GameEngine(canvasRef.current, mapRef.current, setHud);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    engineRef.current?.start();
    setStarted(true);
    setPaused(false);
  }, []);

  const restart = useCallback(() => {
    engineRef.current?.reset();
    setPaused(false);
  }, []);

  const over = hud.status !== "playing";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) {
        if (e.code === "Enter") start();
        return;
      }
      if (over) {
        if (e.code === "Enter" || e.code === "KeyR") restart();
        return;
      }
      if (e.code === "Escape" || e.code === "KeyP") {
        setPaused((p) => {
          engineRef.current?.setPaused(!p);
          return !p;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, over, start, restart]);

  const urgent = hud.timeLeft !== null && hud.timeLeft < 8;

  return (
    <div className="dark fixed inset-0 overflow-hidden bg-black font-sans text-white select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* ---------- HUD ---------- */}
      <div
        className={`pointer-events-none absolute inset-0 p-4 transition-opacity duration-500 ${
          started ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* 좌상단: 수입 / 수배 */}
        <Card size="sm" className={`absolute top-4 left-4 w-56 ${panel}`}>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold tabular-nums text-emerald-400">
              {won(hud.money)}
            </div>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>배달 완료 {hud.deliveries}건</span>
              <Badge
                variant={hud.wanted > 0 ? "destructive" : "secondary"}
                className={hud.wanted > 0 ? "animate-pulse" : ""}
              >
                수배 {"★".repeat(hud.wanted)}
                {"☆".repeat(3 - hud.wanted)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 상단 중앙: 미션 */}
        <div className="absolute top-4 left-1/2 flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col items-center gap-2">
          <Card size="sm" className={`w-full ${panel}`}>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{hud.missionTitle}</div>
                <div className="truncate text-sm text-white/70">{hud.missionDetail}</div>
              </div>
              <div className="shrink-0 text-right">
                {hud.timeLeft !== null && (
                  <div
                    className={`text-xl font-bold tabular-nums ${
                      urgent ? "animate-pulse text-red-400" : "text-amber-300"
                    }`}
                  >
                    {hud.timeLeft.toFixed(1)}초
                  </div>
                )}
                <div className="text-sm tabular-nums text-white/70">{hud.distance}m</div>
              </div>
            </CardContent>
          </Card>
          {hud.message && !over && (
            <Badge className="h-auto bg-amber-400 px-3 py-1 text-sm text-black">
              {hud.message}
            </Badge>
          )}
        </div>

        {/* 좌하단: 미니맵 */}
        <Card size="sm" className={`absolute bottom-4 left-4 p-2 ${panel}`}>
          <canvas
            ref={mapRef}
            width={200}
            height={200}
            className="size-40 rounded-md sm:size-[200px]"
          />
        </Card>

        {/* 우하단: 속도 / 내구도 */}
        <Card size="sm" className={`absolute right-4 bottom-4 w-56 ${panel}`}>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-5xl font-black tabular-nums italic">{hud.speed}</span>
              <span className="text-sm text-white/60">km/h</span>
            </div>
            <Progress
              value={hud.health}
              className={hud.health < 30 ? "[&_[data-slot=progress-indicator]]:bg-red-500" : ""}
            >
              <ProgressLabel className="text-xs text-white/70">차량 내구도</ProgressLabel>
              <ProgressValue className="text-xs" />
            </Progress>
          </CardContent>
        </Card>
      </div>

      {/* ---------- 시작 화면 ---------- */}
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4">
          <Card className={`w-full max-w-md ${panel}`}>
            <CardHeader>
              <CardDescription className="tracking-[0.3em] text-amber-300">
                SEOUL · YEOUIDO
              </CardDescription>
              <CardTitle className="text-3xl font-black">서울 드라이브: 여의도</CardTitle>
              <CardDescription className="text-white/70">
                노을 지는 63빌딩 아래, 여의도 도로를 누비며 배달 미션을 완수하세요. 다른
                차와 부딪히면 수배 레벨이 올라 경찰이 추격합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {CONTROLS.map(([key, desc]) => (
                  <li key={key} className="flex items-center justify-between">
                    <Badge variant="outline" className="border-white/30 font-mono text-white">
                      {key}
                    </Badge>
                    <span className="text-white/80">{desc}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full text-base font-bold" onClick={start}>
                게임 시작 (Enter)
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ---------- 일시정지 ---------- */}
      {started && paused && !over && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-xs text-center ${panel}`}>
            <CardHeader>
              <CardTitle className="text-2xl">일시정지</CardTitle>
              <CardDescription className="text-white/70">
                Esc 또는 P 키로 계속할 수 있습니다
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => {
                  engineRef.current?.setPaused(false);
                  setPaused(false);
                }}
              >
                계속하기
              </Button>
              <Button variant="outline" className="w-full" onClick={restart}>
                처음부터 다시
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ---------- 게임 오버 ---------- */}
      {started && over && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
          <Card className={`w-full max-w-sm text-center ${panel}`}>
            <CardHeader>
              <CardTitle className="text-4xl font-black text-red-400">
                {hud.status === "busted" ? "검거되었습니다" : "차량 대파"}
              </CardTitle>
              <CardDescription className="text-white/70">
                {hud.status === "busted"
                  ? "경찰에게 붙잡혔습니다. 멈추지 말고 달아나세요!"
                  : "차가 더는 움직이지 않습니다. 안전 운전하세요!"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-bold tabular-nums text-emerald-400">
                {won(hud.money)}
              </div>
              <div className="text-sm text-white/70">배달 완료 {hud.deliveries}건</div>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full font-bold" onClick={restart}>
                다시 시작 (Enter)
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
