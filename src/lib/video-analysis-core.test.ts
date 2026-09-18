import { describe, expect, it } from "vitest";
import { parseSegmentLabels } from "./video-analysis-core";

const label = {
  frame: 1,
  striking: "near",
  side: "forehand",
  depth: "front",
  family: "drop",
  racketPrep: "high",
  rallyEnd: false,
  note: "",
};

describe("parseSegmentLabels", () => {
  it("accepts the documented {labels:[...]} shape", () => {
    expect(parseSegmentLabels(JSON.stringify({ labels: [label] }))).toHaveLength(1);
  });

  it("accepts a bare array, which vision models often return instead", () => {
    expect(parseSegmentLabels(JSON.stringify([label]))).toHaveLength(1);
  });

  it("accepts common key aliases", () => {
    expect(parseSegmentLabels(JSON.stringify({ frames: [label] }))).toHaveLength(1);
    expect(parseSegmentLabels(JSON.stringify({ results: [label] }))).toHaveLength(1);
  });

  it("unwraps fenced JSON from chatty replies", () => {
    const raw = "Here you go:\n```json\n" + JSON.stringify({ labels: [label] }) + "\n```";
    expect(parseSegmentLabels(raw)).toHaveLength(1);
  });

  it("returns null rather than throwing on unusable output", () => {
    expect(parseSegmentLabels("not json at all")).toBeNull();
    expect(parseSegmentLabels("")).toBeNull();
  });
});
