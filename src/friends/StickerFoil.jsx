import { useEffect, useRef, useState } from "react";
import { motion, useMotionTemplate, useReducedMotion, useSpring, useTransform } from "motion/react";
import { orientationTilt, pointerTilt } from "./sticker-tilt.js";
import "./sticker-foil.css";

const spring = { duration: .5, bounce: .2 };
const corners = ["top-left", "top-right", "bottom-left", "bottom-right"];

function FoilCorner({ corner, x, y, light }) {
  const opacity = useTransform([x, y, light], ([a, b, intensity]) => {
    const horizontal = corner.endsWith("left") ? -1 : 1;
    const vertical = corner.startsWith("top") ? -1 : 1;
    return .12 + intensity * Math.max(.1, (2 + a * horizontal + b * vertical) / 4) * .88;
  });
  return <motion.span className={`sticker-optic-corner is-${corner}`} aria-hidden="true" style={{ opacity }} />;
}

export default function StickerFoil({ url, name }) {
  const reduce = useReducedMotion();
  const x = useSpring(0, spring), y = useSpring(0, spring), light = useSpring(0, spring);
  const rotateX = useTransform(y, value => -value * 14);
  const rotateY = useTransform(x, value => value * 14);
  const transform = useMotionTemplate`perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  const foilTransform = useTransform([x, y], ([a, b]) => `translate(${a * 18}%, ${b * 18}%) rotate(${a * 18 - b * 12}deg)`);
  const glareTransform = useTransform([x, y], ([a, b]) => `translate(${a * 35}%, ${b * 35}%)`);
  const foilOpacity = useTransform(light, value => value * .55);
  const pulseUntil = useRef(0);
  const timer = useRef(null), neutral = useRef(null), touching = useRef(false), mounted = useRef(true);
  const [sensor, setSensor] = useState("off");
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const supportsSensor = typeof window !== "undefined" && !!window.DeviceOrientationEvent;
  const needsPermission = supportsSensor && typeof window.DeviceOrientationEvent.requestPermission === "function";

  const reset = () => { x.set(0); y.set(0); light.set(0); };
  const point = (event) => {
    const tilt = pointerTilt(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    x.set(tilt.x); y.set(tilt.y); light.set(.5 + Math.max(Math.abs(tilt.x), Math.abs(tilt.y)) * .5);
    return tilt;
  };
  const pulse = (event) => {
    window.clearTimeout(timer.current);
    // Keyboard activation has no coordinates; show the same light feedback.
    if (event.detail) {
      const tilt = point(event);
      if (Math.abs(tilt.x) + Math.abs(tilt.y) < .2) { x.set(.55); y.set(-.45); }
    }
    light.set(1);
    pulseUntil.current = Date.now() + 1100;
    timer.current = window.setTimeout(reset, 1100);
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; window.clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    if (reduce || !supportsSensor || (needsPermission && sensor !== "on")) return undefined;
    neutral.current = null;
    let frame = 0, latest;
    const update = (event) => {
      if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma) || document.hidden || touching.current || Date.now() < pulseUntil.current) return;
      const angle = window.screen?.orientation?.angle ?? window.orientation ?? 0;
      if (!neutral.current || neutral.current.angle !== angle) neutral.current = { beta: event.beta, gamma: event.gamma, angle };
      latest = orientationTilt(event, neutral.current, angle);
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        x.set(latest.x); y.set(latest.y);
        light.set(Math.min(1, Math.hypot(latest.x, latest.y)));
      });
    };
    const pause = () => { if (document.hidden) { neutral.current = null; reset(); } };
    window.addEventListener("deviceorientation", update, { passive: true });
    document.addEventListener("visibilitychange", pause);
    return () => { window.removeEventListener("deviceorientation", update); document.removeEventListener("visibilitychange", pause); window.cancelAnimationFrame(frame); };
  }, [reduce, supportsSensor, needsPermission, sensor, x, y, light]);

  const enableSensor = async () => {
    if (permissionBusy) return;
    setPermissionBusy(true);
    try {
      // Call immediately inside this click: Safari requires user activation.
      const result = await window.DeviceOrientationEvent.requestPermission();
      if (mounted.current) { setSensor(result === "granted" ? "on" : "off"); setPermissionDenied(result !== "granted"); }
    } catch { if (mounted.current) setPermissionDenied(true); }
    finally { if (mounted.current) setPermissionBusy(false); }
  };

  return <div className="sticker-optic">
    <button className="sticker-optic-trigger" type="button" aria-label={`轻点${name || "贴纸"}的四角，查看镭射反光`}
      onPointerDown={(event) => { touching.current = true; window.clearTimeout(timer.current); point(event); }}
      onPointerMove={(event) => { if (event.pointerType === "mouse" || event.buttons) point(event); }}
      onPointerUp={() => { touching.current = false; }}
      onPointerCancel={() => { touching.current = false; reset(); }}
      onPointerLeave={() => { touching.current = false; window.clearTimeout(timer.current); reset(); }}
      onClick={pulse}>
      <motion.span className="sticker-optic-surface" style={{ transform: reduce ? "none" : transform }}>
        <img src={url} alt={`${name || "收集"}的贴纸`} draggable="false" />
        <span className="sticker-optic-mask" style={{ maskImage: `url("${url}")`, WebkitMaskImage: `url("${url}")` }} aria-hidden="true">
          <motion.span className="sticker-optic-rainbow" style={{ opacity: foilOpacity, transform: reduce ? "none" : foilTransform }} />
          <motion.span className="sticker-optic-glare" style={{ opacity: foilOpacity, transform: reduce ? "none" : glareTransform }} />
        </span>
        {corners.map(corner => <FoilCorner key={corner} corner={corner} x={x} y={y} light={light} />)}
      </motion.span>
    </button>
    <span className="sticker-optic-hint">轻点四角，看贴纸闪闪发光{!reduce && supportsSensor && (!needsPermission || sensor === "on") ? " · 试试轻轻转动手机" : ""}</span>
    {!reduce && needsPermission && sensor !== "on" && <button type="button" className="sticker-optic-enable" onClick={enableSensor} disabled={permissionBusy}>开启重力感应</button>}
    {permissionDenied && <span className="sticker-optic-hint" role="status">还可以轻点或滑动贴纸查看反光</span>}
  </div>;
}
