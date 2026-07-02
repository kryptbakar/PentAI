import { describe, it, expect } from "vitest";
import { isPrivateIp, isBlockedHostname, assertPublicHost, UnsafeTargetError } from "../net-guard";

describe("isPrivateIp", () => {
  it("blocks IPv4 private / reserved ranges", () => {
    for (const ip of [
      "10.0.0.1",
      "10.255.255.255",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "127.0.0.1",
      "0.0.0.0",
      "169.254.0.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "224.0.0.1", // multicast
      "240.0.0.1", // reserved
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4 addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "11.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it("blocks IPv6 loopback, link-local, ULA and mapped-private", () => {
    for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6 and mapped-public", () => {
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("isBlockedHostname", () => {
  it("blocks reserved/internal hostnames", () => {
    for (const h of ["localhost", "app.localhost", "db.internal", "printer.local", "metadata.google.internal", "host.lan"]) {
      expect(isBlockedHostname(h), h).toBe(true);
    }
  });

  it("allows normal public hostnames", () => {
    for (const h of ["example.com", "app.example.com", "sub.domain.co.uk"]) {
      expect(isBlockedHostname(h), h).toBe(false);
    }
  });
});

describe("assertPublicHost", () => {
  it("rejects a private IP literal", async () => {
    await expect(assertPublicHost("192.168.0.1")).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it("rejects the cloud metadata IP", async () => {
    await expect(assertPublicHost("169.254.169.254")).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it("rejects a blocked hostname without doing DNS", async () => {
    await expect(assertPublicHost("localhost")).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it("passes through a public IP literal unchanged", async () => {
    await expect(assertPublicHost("8.8.8.8")).resolves.toBe("8.8.8.8");
  });

  it("can be bypassed with PENTAI_ALLOW_PRIVATE_TARGETS for lab use", async () => {
    process.env.PENTAI_ALLOW_PRIVATE_TARGETS = "1";
    try {
      await expect(assertPublicHost("10.0.0.1")).resolves.toBe("10.0.0.1");
    } finally {
      delete process.env.PENTAI_ALLOW_PRIVATE_TARGETS;
    }
  });
});
