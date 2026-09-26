import test from "node:test";
import assert from "node:assert/strict";
import { isActiveChannelMember, parseStartSource } from "../src/membership.js";

test("recognises active channel membership statuses", () => {
  assert.equal(isActiveChannelMember({ status: "creator" }), true);
  assert.equal(isActiveChannelMember({ status: "administrator" }), true);
  assert.equal(isActiveChannelMember({ status: "member" }), true);
  assert.equal(isActiveChannelMember({ status: "restricted", is_member: true }), true);
  assert.equal(isActiveChannelMember({ status: "restricted", is_member: false }), false);
  assert.equal(isActiveChannelMember({ status: "left" }), false);
  assert.equal(isActiveChannelMember({ status: "kicked" }), false);
});

test("keeps only Telegram-safe deep-link source values", () => {
  assert.equal(parseStartSource("ig_reel_01"), "ig_reel_01");
  assert.equal(parseStartSource("youtube-short-1"), "youtube-short-1");
  assert.equal(parseStartSource(" bad value! "), "badvalue");
  assert.equal(parseStartSource(""), "direct");
});
