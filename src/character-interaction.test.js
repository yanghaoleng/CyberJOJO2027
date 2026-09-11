import assert from "node:assert/strict";
import test from "node:test";
import { createCharacterInteraction, getChewingPose, mouthAnchorOnCanvas } from "./character-interaction.js";

test("chewing has a closed jaw, open jaw and returns to closed on its own rhythm", () => {
  const period = 1000 / 3.8;
  const closed = getChewingPose(0), open = getChewingPose(period / 2), again = getChewingPose(period);
  assert.ok(open.scaleY > closed.scaleY * 4);
  assert.ok(Math.abs(closed.scaleY - again.scaleY) < 0.001);
  assert.ok(closed.scaleX > open.scaleX);
});

test("mouth anchor includes the shipped artboard's centered frame origin and canvas letterbox", () => {
  const instance = { canvas: { width: 1200, height: 640 }, artboard: { bounds: { minX: 0, minY: 0, maxX: 2048, maxY: 1664 }, frameOrigin: true } };
  const position = mouthAnchorOnCanvas(instance, { worldTransform: () => ({ tx: 0, ty: 0 }) });
  assert.equal(position.x, 0.5); assert.equal(position.y, 0.5);
  assert.equal(mouthAnchorOnCanvas(instance, null), null);
});

test("controller installs after regular advancement, restores nodes and never starts speech playback", () => {
  const nodes = new Map(["controller_eyeball_location", "controller_faceq", "IP_CJ_mouth_Y", "IP_CJ_mouth1"].map((name) => [name, { x: 0, y: 0, scaleX: 1, scaleY: 1 }]));
  const order = [];
  class Pose { apply() { order.push("pose"); } delete() {} }
  const instance = { canvas: { width: 1200, height: 640 }, runtime: { LinearAnimationInstance: Pose },
    artboard: { node: (name) => nodes.get(name), animationByName: () => ({}), advance: () => order.push("constraints") },
    advanceAndReportChanges() { order.push("normal"); }, play() { assert.fail("Speech playback must not be started"); } };
  const original = instance.advanceAndReportChanges;
  const controller = createCharacterInteraction(instance);
  assert.equal(controller.capabilities.chewing, true); assert.equal(controller.install(), true);
  controller.update({ x: 1, y: -1, mouthOpen: true }, 10);
  instance.advanceAndReportChanges(0.016);
  assert.deepEqual(order, ["normal", "pose", "constraints"]);
  assert.ok(nodes.get("controller_eyeball_location").x > 0);
  assert.equal(nodes.get("IP_CJ_mouth_Y").scaleY, 1.8);
  controller.reset();
  assert.equal(nodes.get("controller_eyeball_location").x, 0); assert.equal(nodes.get("IP_CJ_mouth_Y").scaleY, 1);
  controller.dispose(); assert.equal(instance.advanceAndReportChanges, original);
});

test("ZHc feeding samples a closed first frame without starting the speech timeline", () => {
  const mouth = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  const applied = [];
  class Pose { apply() { applied.push(this.time); } delete() {} }
  const instance = {
    runtime: { LinearAnimationInstance: Pose },
    artboard: {
      node: (name) => name === "IP_CJ_mouth_Y" ? mouth : null,
      animationByName: (name) => name === "Talking_Normal" ? {} : null,
      advance() {},
    },
    play() { assert.fail("Feeding must not play the speech timeline"); },
  };
  const controller = createCharacterInteraction(instance);
  assert.equal(controller.capabilities.mouth, true);
  assert.equal(controller.capabilities.chewing, true);
  controller.update({ mouthOpen: true }, 10);
  controller.afterAdvance(10);
  assert.equal(applied.at(-1), 0.5);
  controller.update({ mouthOpen: false }, 20);
  controller.afterAdvance(20);
  assert.equal(applied.at(-1), 0);
  controller.dispose();
});
