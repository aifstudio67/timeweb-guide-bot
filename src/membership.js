export function isActiveChannelMember(member) {
  if (!member) return false;

  if (["creator", "administrator", "member"].includes(member.status)) {
    return true;
  }

  return member.status === "restricted" && member.is_member === true;
}

export function parseStartSource(payload) {
  const source = String(payload ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 64);

  return source || "direct";
}
