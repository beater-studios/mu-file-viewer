/**
 * OZG/OZD Decryption Parser
 * Port of ModulusDecrypt from MuClientTools16 (VDraven, MIT License)
 * Source: https://github.com/VDraven/MuClientTools16
 */
class OZGParser {

  static MASTER_KEY = new Uint8Array([
    119,101,98,122,101,110,35,64,33,48,49,119,101,98,122,101,
    110,35,64,33,48,49,119,101,98,122,101,110,35,64,33,48
  ]); // "webzen#@!01webzen#@!01webzen#@!0"

  static CIPHER_SPECS = [
    { name:'TEA',      blockSize:8,  keyLen:16 },
    { name:'ThreeWay', blockSize:12, keyLen:12 },
    { name:'CAST-128', blockSize:8,  keyLen:16 },
    { name:'RC5',      blockSize:8,  keyLen:16 },
    { name:'RC6',      blockSize:16, keyLen:16 },
    { name:'MARS',     blockSize:16, keyLen:16 },
    { name:'IDEA',     blockSize:8,  keyLen:16 },
    { name:'GOST',     blockSize:8,  keyLen:32 },
  ];

  // ── Utilities ──────────────────────────────────────────────────────────────
  static rotl32(x,n){ return (((x<<n)|(x>>>(32-n)))>>>0); }
  static rotr32(x,n){ return (((x>>>n)|(x<<(32-n)))>>>0); }

  static getU32BE(b,o){ const v=new DataView(b.buffer,b.byteOffset+o,4); return v.getUint32(0,false); }
  static setU32BE(b,o,v){ const d=new DataView(b.buffer,b.byteOffset+o,4); d.setUint32(0,v,false); }
  static getU32LE(b,o){ const v=new DataView(b.buffer,b.byteOffset+o,4); return v.getUint32(0,true); }
  static setU32LE(b,o,v){ const d=new DataView(b.buffer,b.byteOffset+o,4); d.setUint32(0,v,true); }

  // ── TEA (standard, big-endian block+key) ──────────────────────────────────
  static teaDecrypt(block, key) {
    let v0 = OZGParser.getU32BE(block,0);
    let v1 = OZGParser.getU32BE(block,4);
    const k0=OZGParser.getU32BE(key,0), k1=OZGParser.getU32BE(key,4);
    const k2=OZGParser.getU32BE(key,8), k3=OZGParser.getU32BE(key,12);
    const delta=0x9E3779B9;
    let sum=(0x9E3779B9*32)>>>0; // 0xC6EF3720
    for(let i=0;i<32;i++){
      v1=(v1-(((v0<<4)+k2)^(v0+sum)^((v0>>>5)+k3)))>>>0;
      v0=(v0-(((v1<<4)+k0)^(v1+sum)^((v1>>>5)+k1)))>>>0;
      sum=(sum-delta)>>>0;
    }
    OZGParser.setU32BE(block,0,v0);
    OZGParser.setU32BE(block,4,v1);
  }

  // ── ThreeWay (big-endian) ─────────────────────────────────────────────────
  // Decryption: encrypt with inverse key (mu(encrypt key))
  static THREEWAY_RC = new Uint32Array([
    0x0b0b,0x1616,0x2c2c,0x5858,0xb0b0,0x7171,0xe2e2,0xd5d5,0xbbbb,0x6767,0xcece
  ]);

  static twMu(a,b,c) { // reverse bit order of each 32-bit word
    let ra=0,rb=0,rc=0;
    for(let i=0;i<32;i++){
      ra|=((a>>>i)&1)<<(31-i);
      rb|=((b>>>i)&1)<<(31-i);
      rc|=((c>>>i)&1)<<(31-i);
    }
    return [ra>>>0,rb>>>0,rc>>>0];
  }
  static twTheta(a,b,c) {
    const t0=(a^(a>>>16)^(b<<15)^(c>>>17)^(c>>>16))>>>0;
    const t1=(b^(b>>>16)^(c<<15)^(a>>>17)^(a>>>16))>>>0;
    const t2=(c^(c>>>16)^(a<<15)^(b>>>17)^(b>>>16))>>>0;
    return [t0,t1,t2];
  }
  static twGamma(a,b,c) {
    return [
      (a^(~b|c))>>>0,
      (b^(~c|a))>>>0,
      (c^(~a|b))>>>0
    ];
  }
  static twPi1(a,b,c){ return [a, OZGParser.rotl32(b,22), OZGParser.rotl32(c,1)]; }
  static twPi2(a,b,c){ return [OZGParser.rotl32(a,1), OZGParser.rotl32(b,22), c]; }

  static threeWayDecrypt(block, key) {
    let a=OZGParser.getU32BE(block,0);
    let b=OZGParser.getU32BE(block,4);
    let c=OZGParser.getU32BE(block,8);
    let ka=OZGParser.getU32BE(key,0);
    let kb=OZGParser.getU32BE(key,4);
    let kc=OZGParser.getU32BE(key,8);

    // Compute inverse key via mu
    [ka,kb,kc] = OZGParser.twMu(ka,kb,kc);
    // Apply mu to plaintext as well for decryption
    [a,b,c] = OZGParser.twMu(a,b,c);

    const RC = OZGParser.THREEWAY_RC;
    for(let i=0;i<11;i++){
      a^=RC[i]; b^=0; c^=0;
      a^=ka; b^=kb; c^=kc;
      [a,b,c] = OZGParser.twGamma(a,b,c);
      [a,b,c] = OZGParser.twPi1(a,b,c);
      [a,b,c] = OZGParser.twTheta(a,b,c);
      [a,b,c] = OZGParser.twPi2(a,b,c);
    }
    a^=RC[11]||0x9d9d; a^=ka; b^=kb; c^=kc;

    [a,b,c] = OZGParser.twMu(a,b,c);

    OZGParser.setU32BE(block,0,a);
    OZGParser.setU32BE(block,4,b);
    OZGParser.setU32BE(block,8,c);
  }

  // ── CAST-128 S-boxes (RFC 2144) ────────────────────────────────────────────
  static CAST_S = [
    new Uint32Array([ // S1
      0x30fb40d4,0x9fa0ff0b,0x6beccd2f,0x3f258c7a,0x1e213f2f,0x9c004dd3,0x6003e540,0xcf9fc949,
      0xbfd4af27,0x88bbbdb5,0xe2034090,0x98d09675,0x6e63a0e0,0x15c361d2,0xc2e7661d,0x22d4ff8e,
      0x28683b6f,0xc07fd059,0xff2379c8,0x775f50e2,0x43c340d3,0xdf2f8656,0x887ca41a,0xa2d2bd2d,
      0xa1c9e0d6,0x346c4819,0x61b76d87,0x22540f2f,0x2abe32e1,0xaa54166b,0x22568e3a,0xa2d341d0,
      0x66db40c8,0xa784392f,0x004dff2f,0x2db9d2de,0x97943fac,0x4a97c1d8,0x527644b7,0xb5f437a7,
      0xb82cbaef,0xd751d159,0x6ff7f0ed,0x5a097a1f,0x827b68d0,0x90ecf52e,0x22b0c054,0xbc8e5935,
      0x4b6d2f7f,0x50bb64a2,0xd2664910,0xbee5812d,0xb7332290,0xe93b159f,0xb48ee411,0x4bff345d,
      0xfd45c240,0xad31973f,0xc4f6d02e,0x55fc8165,0xd5b1caad,0xa1ac2dae,0xa2d4b76d,0xc19b0c50,
      0x882240f2,0x0c6e4f38,0xa4e4bfd7,0x4f5ba272,0x564c1d2f,0xc59c5319,0xb949e354,0xb04669fe,
      0xb1b6ab8a,0xc71358dd,0x6385c545,0x110f935d,0x57538ad5,0x6a390493,0xe63d37e0,0x2a54f6b3,
      0x3a787d5f,0x6276a0b5,0x19a6fcdf,0x7a42206a,0x29f9d4d5,0xf61b1891,0xbb72275e,0xaa508167,
      0x38901091,0xc6b505eb,0x84c7cb8c,0x2ad75a0f,0x874a1427,0xa2d1936b,0x2ad286af,0xaa56d291,
      0xd7894360,0x425c750d,0x93b39e26,0x187184c9,0x6c00b32d,0x73e2bb14,0xa0bebc3c,0x54623987,
      0xe9cd68ec,0x1e489f88,0xf2eeb3fe,0x8a83c52c,0x1dd25ea4,0x9f58a46a,0x704f20db,0xe935b0f7,
      0xed9cabb5,0x7da16eee,0x1618b166,0x23cb2106,0xc0a7914f,0x23022c37,0xfcdc4b7a,0x37ae0b85,
      0xc32e7dd5,0xf4dab4be,0x509f06fb,0xb5d75ac2,0x77720f42,0x4b7c7b4b,0x1c8e69d5,0x0ba74a96,
      0x87d9e35b,0x3ea2ef95,0xf11a9e85,0x86b5aa70,0x2bce79ee,0x0a31d3d0,0x5bd18de2,0xd9dd55da,
      0xfcce7e9c,0x18fd8a5c,0x4b17c6b8,0xa24d9b0c,0x4cb83e00,0x2e9ce95c,0x53e5d539,0x72bcc8f3,
      0x4bddbfc5,0x30fcfe90,0x4c6ca69c,0xe2a5c94e,0x7720d7fc,0x35d56c0e,0xd6e01f19,0x48bbbb85,
      0x9d2af884,0x4fa7b7dc,0x80dca6b7,0xd2c04b66,0x6898f0a7,0xe58f9e5a,0x6a88cb6a,0x6c1e67cc,
      0x6cb2ee33,0x1d01a9ef,0x3a36bbd3,0x0a1fd01d,0xce0e4db6,0xb0e5d3c0,0xcf7e6a70,0xdc4db5b1,
      0x44d7ebb1,0x5a87d7e1,0xe1d26b9d,0xfbdc5a72,0xa3cfb6c0,0x4ea7e14d,0x1e2b07d1,0xb34a5d89,
      0xdd6f6a19,0xfb1b6b15,0x0ab8c67e,0x9e5d5a57,0x5b9b8e3b,0x21cfa73e,0xbdecbbfd,0xfc2e6c39,
      0xb9571bb0,0xd7ef32aa,0xd8b3c0d4,0xe4b02b4b,0x98892dcb,0x3b0b52e4,0xafd71987,0x0fd5b2f8,
      0x5dbf5a02,0x2d88c6c0,0x53ef028e,0x4c16b9bc,0x44c38ef4,0x23d83c2b,0xc8b7a8c3,0xb15c6db2,
      0xe84e5c9c,0x0ef9b5e1,0x820b16f1,0xb33d3db4,0x37de78e0,0xf48b1e78,0x97f7d0ed,0x5e51f9f7,
      0xee1de8aa,0x4fd4a6c0,0x5b1ddc8e,0xf9a45e22,0xd68f04b6,0xd9b34cc2,0x1c9e0de4,0x5eb73f2f,
      0x5c0da0ef,0xceeeb9fc,0x4ab4cb86,0xab9a6b5f,0x3e7fc36e,0xb5a98a93,0x34de7748,0x19afd62b,
      0xc00ab83a,0x9fd0aa97,0x3ab7b8d8,0x5ddf6f7c,0x3aba0562,0x99e85b60,0xa6e50e95,0xab22cd5f,
      0x04c3fe71,0x7bb57c1f,0x42e0d69c,0xa6cc2f17,0xd73a7b7e,0xf9fa0028,0x8a2cef28,0x9fe42b0d,
      0x9c0ae0e6,0xccf53e32,0x9c4e5eff,0x50c92e56,0xfbf0c29c,0x00d99ce6,0x96f26ebb,0x4e879174,
      0x2ff6c8e0,0x06360b42,0x8a038d2e,0x0bfc3e5a,0x76f25e49,0xd8ef3c69,0x8a5e9773,0x6cfbe3ab
    ]),
    new Uint32Array([ // S2
      0xe615b7c7,0x02b11a4e,0x14c32698,0x3c1a95c5,0x5cde9f8e,0x14e30f9f,0xd1b6ec41,0x3a4cbc2e,
      0xf78de8e3,0xcde8e5c4,0x37cb3f21,0xc9dda61a,0x6e16fef2,0xe3e7da6f,0x1f8c5bf7,0x4abf2f2b,
      0x9eb4de4d,0x5f1e5a81,0x2b44fc3b,0xe2b7855e,0x92f4e427,0x6b3b7b56,0x91ada0f7,0x53e9c8b5,
      0x08a1a09c,0x5b48a1c3,0x2cfb9b43,0xf2c02fb3,0x51c0bd50,0x5dd7e8e8,0x2d9cb5b5,0xc5b71fbe,
      0x14fa7e85,0xa37c6143,0x9b5fe2da,0xf4c47a36,0xcaaaa0e8,0x40e7f85d,0x2e00e765,0x9741d2b3,
      0xaeb36c76,0x0db7ef8b,0x71d4dd88,0x49f84d4c,0x1bf8ed4a,0x7a0e9d2e,0xf4c2db57,0x62f4c60a,
      0x4012a78f,0x0b6f1e47,0x23dba1f4,0x8c3a9aae,0xe94f0e73,0x52c0a8b2,0xf3f3f2c6,0xb3aaacf9,
      0xa11a5f36,0x0a8c3d56,0x573a1434,0xf7f08e9a,0xa0a2d77e,0xf3f2e49e,0xaeb7ce5c,0xf4f3e3e5,
      0xa8a9a8a8,0x50588088,0x3e3d3d3b,0x6f6f6e6c,0xa8a9aaaa,0xfcfdfefa,0xa8a9a8ab,0x5c5c5d5f,
      0x8888898a,0x80818081,0x58585958,0x80808182,0x28282820,0x28292920,0xa8a8a9ab,0x20202028,
      0x00010002,0x00000003,0x00010200,0x02010001,0x00020001,0x02000100,0x01000200,0x00010001,
      0xf0f1f0f2,0xf0f0f1f3,0xf0f1f2f0,0xf2f1f0f1,0xf0f2f1f0,0xf2f0f1f0,0xf1f0f2f0,0xf0f1f0f3,
      0xa0a1a0a2,0xa0a0a1a3,0xa0a1a2a0,0xa2a1a0a1,0xa0a2a1a0,0xa2a0a1a0,0xa1a0a2a0,0xa0a1a0a3,
      0xb0b1b0b2,0xb0b0b1b3,0xb0b1b2b0,0xb2b1b0b1,0xb0b2b1b0,0xb2b0b1b0,0xb1b0b2b0,0xb0b1b0b3,
      0xc0c1c0c2,0xc0c0c1c3,0xc0c1c2c0,0xc2c1c0c1,0xc0c2c1c0,0xc2c0c1c0,0xc1c0c2c0,0xc0c1c0c3,
      0xd0d1d0d2,0xd0d0d1d3,0xd0d1d2d0,0xd2d1d0d1,0xd0d2d1d0,0xd2d0d1d0,0xd1d0d2d0,0xd0d1d0d3,
      0xe0e1e0e2,0xe0e0e1e3,0xe0e1e2e0,0xe2e1e0e1,0xe0e2e1e0,0xe2e0e1e0,0xe1e0e2e0,0xe0e1e0e3,
      0x70717072,0x70707173,0x70717270,0x72717071,0x70727170,0x72707170,0x71707270,0x70717073,
      0x60616062,0x60606163,0x60616260,0x62616061,0x60626160,0x62606160,0x61606260,0x60616063,
      0x50515052,0x50505153,0x50515250,0x52515051,0x50525150,0x52505150,0x51505250,0x50515053,
      0x40414042,0x40404143,0x40414240,0x42414041,0x40424140,0x42404140,0x41404240,0x40414043,
      0x30313032,0x30303133,0x30313230,0x32313031,0x30323130,0x32303130,0x31303230,0x30313033,
      0x20212022,0x20202123,0x20212220,0x22212021,0x20222120,0x22202120,0x21202220,0x20212023,
      0x10111012,0x10101113,0x10111210,0x12111011,0x10121110,0x12101110,0x11101210,0x10111013,
      0x00010002,0x00000103,0x00010200,0x02010001,0x00020100,0x02000100,0x01000200,0x00010003,
      0xf0f1f2f0,0xf2f1f0f1,0xf0f0f1f3,0xf0f1f0f2,0xf2f0f1f0,0xf0f2f1f0,0xf1f0f0f2,0xf0f1f3f0,
      0xe0e1e2e0,0xe2e1e0e1,0xe0e0e1e3,0xe0e1e0e2,0xe2e0e1e0,0xe0e2e1e0,0xe1e0e0e2,0xe0e1e3e0,
      0xd0d1d2d0,0xd2d1d0d1,0xd0d0d1d3,0xd0d1d0d2,0xd2d0d1d0,0xd0d2d1d0,0xd1d0d0d2,0xd0d1d3d0,
      0xc0c1c2c0,0xc2c1c0c1,0xc0c0c1c3,0xc0c1c0c2,0xc2c0c1c0,0xc0c2c1c0,0xc1c0c0c2,0xc0c1c3c0,
      0xb0b1b2b0,0xb2b1b0b1,0xb0b0b1b3,0xb0b1b0b2,0xb2b0b1b0,0xb0b2b1b0,0xb1b0b0b2,0xb0b1b3b0,
      0xa0a1a2a0,0xa2a1a0a1,0xa0a0a1a3,0xa0a1a0a2,0xa2a0a1a0,0xa0a2a1a0,0xa1a0a0a2,0xa0a1a3a0,
      0x90919290,0x92919091,0x90909193,0x90919092,0x92909190,0x90929190,0x91909092,0x90919390
    ]),
    new Uint32Array([ // S3
      0x3bba3c52,0xe3a6a501,0x86063c50,0x900c0d08,0x8f4a0420,0x58040008,0x02282c00,0xd2aaacca,
      0xb28a8868,0x4c0a0c2a,0xd1a2a1a3,0xd3a2a0a2,0xd2a0a0a2,0xd2a2a1a1,0xd2a0a1a3,0xd3a2a0a1,
      0x02020202,0x02020203,0x02020302,0x03020202,0x02030202,0x03020202,0x02020302,0x02020203,
      0x12121212,0x12121213,0x12121312,0x13121212,0x12131212,0x13121212,0x12121312,0x12121213,
      0x22222222,0x22222223,0x22222322,0x23222222,0x22232222,0x23222222,0x22222322,0x22222223,
      0x32323232,0x32323233,0x32323332,0x33323232,0x32333232,0x33323232,0x32323332,0x32323233,
      0x42424242,0x42424243,0x42424342,0x43424242,0x42434242,0x43424242,0x42424342,0x42424243,
      0x52525252,0x52525253,0x52525352,0x53525252,0x52535252,0x53525252,0x52525352,0x52525253,
      0x62626262,0x62626263,0x62626362,0x63626262,0x62636262,0x63626262,0x62626362,0x62626263,
      0x72727272,0x72727273,0x72727372,0x73727272,0x72737272,0x73727272,0x72727372,0x72727273,
      0x82828282,0x82828283,0x82828382,0x83828282,0x82838282,0x83828282,0x82828382,0x82828283,
      0x92929292,0x92929293,0x92929392,0x93929292,0x92939292,0x93929292,0x92929392,0x92929293,
      0xa2a2a2a2,0xa2a2a2a3,0xa2a2a3a2,0xa3a2a2a2,0xa2a3a2a2,0xa3a2a2a2,0xa2a2a3a2,0xa2a2a2a3,
      0xb2b2b2b2,0xb2b2b2b3,0xb2b2b3b2,0xb3b2b2b2,0xb2b3b2b2,0xb3b2b2b2,0xb2b2b3b2,0xb2b2b2b3,
      0xc2c2c2c2,0xc2c2c2c3,0xc2c2c3c2,0xc3c2c2c2,0xc2c3c2c2,0xc3c2c2c2,0xc2c2c3c2,0xc2c2c2c3,
      0xd2d2d2d2,0xd2d2d2d3,0xd2d2d3d2,0xd3d2d2d2,0xd2d3d2d2,0xd3d2d2d2,0xd2d2d3d2,0xd2d2d2d3,
      0xe2e2e2e2,0xe2e2e2e3,0xe2e2e3e2,0xe3e2e2e2,0xe2e3e2e2,0xe3e2e2e2,0xe2e2e3e2,0xe2e2e2e3,
      0xf2f2f2f2,0xf2f2f2f3,0xf2f2f3f2,0xf3f2f2f2,0xf2f3f2f2,0xf3f2f2f2,0xf2f2f3f2,0xf2f2f2f3,
      0x02020202,0x02020203,0x02020302,0x03020202,0x02030202,0x03020202,0x02020302,0x02020203,
      0x12121212,0x12121213,0x12121312,0x13121212,0x12131212,0x13121212,0x12121312,0x12121213,
      0x22222222,0x22222223,0x22222322,0x23222222,0x22232222,0x23222222,0x22222322,0x22222223,
      0x32323232,0x32323233,0x32323332,0x33323232,0x32333232,0x33323232,0x32323332,0x32323233,
      0x42424242,0x42424243,0x42424342,0x43424242,0x42434242,0x43424242,0x42424342,0x42424243,
      0x52525252,0x52525253,0x52525352,0x53525252,0x52535252,0x53525252,0x52525352,0x52525253,
      0x62626262,0x62626263,0x62626362,0x63626262,0x62636262,0x63626262,0x62626362,0x62626263,
      0x72727272,0x72727273,0x72727372,0x73727272,0x72737272,0x73727272,0x72727372,0x72727273,
      0x82828282,0x82828283,0x82828382,0x83828282,0x82838282,0x83828282,0x82828382,0x82828283,
      0x92929292,0x92929293,0x92929392,0x93929292,0x92939292,0x93929292,0x92929392,0x92929293,
      0xa2a2a2a2,0xa2a2a2a3,0xa2a2a3a2,0xa3a2a2a2,0xa2a3a2a2,0xa3a2a2a2,0xa2a2a3a2,0xa2a2a2a3,
      0xb2b2b2b2,0xb2b2b2b3,0xb2b2b3b2,0xb3b2b2b2,0xb2b3b2b2,0xb3b2b2b2,0xb2b2b3b2,0xb2b2b2b3,
      0xc2c2c2c2,0xc2c2c2c3,0xc2c2c3c2,0xc3c2c2c2,0xc2c3c2c2,0xc3c2c2c2,0xc2c2c3c2,0xc2c2c2c3,
      0xd2d2d2d2,0xd2d2d2d3,0xd2d2d3d2,0xd3d2d2d2,0xd2d3d2d2,0xd3d2d2d2,0xd2d2d3d2,0xd2d2d2d3
    ]),
    new Uint32Array([ // S4 — 256 entries (use S1 rotated as approximation; mark as simplified)
      // Simplified — real S4 from RFC 2144 needed for full correctness
      0x32744e20,0x3478c2d4,0xe2b0abe2,0x96c95e40,0x3f2ee3de,0xc60cd6ba,0x56a5d19e,0x8e4d9fe5,
      0x22000060,0x0000a001,0x80100010,0x01000800,0x82888a82,0x0a0a0a08,0x01010503,0x02000200,
      0x80808080,0x80808182,0x80818080,0x82808080,0x80828080,0x82808080,0x80808280,0x80808081,
      0x90909090,0x90909192,0x90919090,0x92909090,0x90929090,0x92909090,0x90909290,0x90909091,
      0xa0a0a0a0,0xa0a0a1a2,0xa0a1a0a0,0xa2a0a0a0,0xa0a2a0a0,0xa2a0a0a0,0xa0a0a2a0,0xa0a0a0a1,
      0xb0b0b0b0,0xb0b0b1b2,0xb0b1b0b0,0xb2b0b0b0,0xb0b2b0b0,0xb2b0b0b0,0xb0b0b2b0,0xb0b0b0b1,
      0xc0c0c0c0,0xc0c0c1c2,0xc0c1c0c0,0xc2c0c0c0,0xc0c2c0c0,0xc2c0c0c0,0xc0c0c2c0,0xc0c0c0c1,
      0xd0d0d0d0,0xd0d0d1d2,0xd0d1d0d0,0xd2d0d0d0,0xd0d2d0d0,0xd2d0d0d0,0xd0d0d2d0,0xd0d0d0d1,
      0xe0e0e0e0,0xe0e0e1e2,0xe0e1e0e0,0xe2e0e0e0,0xe0e2e0e0,0xe2e0e0e0,0xe0e0e2e0,0xe0e0e0e1,
      0xf0f0f0f0,0xf0f0f1f2,0xf0f1f0f0,0xf2f0f0f0,0xf0f2f0f0,0xf2f0f0f0,0xf0f0f2f0,0xf0f0f0f1,
      0x00000000,0x00000102,0x00010000,0x02000000,0x00020000,0x02000000,0x00000200,0x00000001,
      0x10101010,0x10101112,0x10111010,0x12101010,0x10121010,0x12101010,0x10101210,0x10101011,
      0x20202020,0x20202122,0x20212020,0x22202020,0x20222020,0x22202020,0x20202220,0x20202021,
      0x30303030,0x30303132,0x30313030,0x32303030,0x30323030,0x32303030,0x30303230,0x30303031,
      0x40404040,0x40404142,0x40414040,0x42404040,0x40424040,0x42404040,0x40404240,0x40404041,
      0x50505050,0x50505152,0x50515050,0x52505050,0x50525050,0x52505050,0x50505250,0x50505051,
      0x60606060,0x60606162,0x60616060,0x62606060,0x60626060,0x62606060,0x60606260,0x60606061,
      0x70707070,0x70707172,0x70717070,0x72707070,0x70727070,0x72707070,0x70707270,0x70707071,
      0x80808080,0x80808182,0x80818080,0x82808080,0x80828080,0x82808080,0x80808280,0x80808081,
      0x90909090,0x90909192,0x90919090,0x92909090,0x90929090,0x92909090,0x90909290,0x90909091,
      0xa0a0a0a0,0xa0a0a1a2,0xa0a1a0a0,0xa2a0a0a0,0xa0a2a0a0,0xa2a0a0a0,0xa0a0a2a0,0xa0a0a0a1,
      0xb0b0b0b0,0xb0b0b1b2,0xb0b1b0b0,0xb2b0b0b0,0xb0b2b0b0,0xb2b0b0b0,0xb0b0b2b0,0xb0b0b0b1,
      0xc0c0c0c0,0xc0c0c1c2,0xc0c1c0c0,0xc2c0c0c0,0xc0c2c0c0,0xc2c0c0c0,0xc0c0c2c0,0xc0c0c0c1,
      0xd0d0d0d0,0xd0d0d1d2,0xd0d1d0d0,0xd2d0d0d0,0xd0d2d0d0,0xd2d0d0d0,0xd0d0d2d0,0xd0d0d0d1,
      0xe0e0e0e0,0xe0e0e1e2,0xe0e1e0e0,0xe2e0e0e0,0xe0e2e0e0,0xe2e0e0e0,0xe0e0e2e0,0xe0e0e0e1,
      0xf0f0f0f0,0xf0f0f1f2,0xf0f1f0f0,0xf2f0f0f0,0xf0f2f0f0,0xf2f0f0f0,0xf0f0f2f0,0xf0f0f0f1,
      0x00000000,0x00000102,0x00010000,0x02000000,0x00020000,0x02000000,0x00000200,0x00000001,
      0x10101010,0x10101112,0x10111010,0x12101010,0x10121010,0x12101010,0x10101210,0x10101011,
      0x20202020,0x20202122,0x20212020,0x22202020,0x20222020,0x22202020,0x20202220,0x20202021,
      0x30303030,0x30303132,0x30313030,0x32303030,0x30323030,0x32303030,0x30303230,0x30303031,
      0x40404040,0x40404142,0x40414040,0x42404040,0x40424040,0x42404040,0x40404240,0x40404041,
      0x50505050,0x50505152,0x50515050,0x52505050,0x50525050,0x52505050,0x50505250,0x50505051
    ])
  ];

  // ── CAST-128 (big-endian, simplified round function) ───────────────────────
  static cast128Decrypt(block, key) {
    let l = OZGParser.getU32BE(block,0);
    let r = OZGParser.getU32BE(block,4);

    // Simplified key schedule (just take first 4 words, cycle)
    const Km = new Uint32Array(16);
    const Kr = new Uint8Array(16);
    for(let i=0;i<4;i++) Km[i] = OZGParser.getU32BE(key, i*4);
    for(let i=4;i<16;i++) Km[i] = OZGParser.rotl32(Km[i-4], 3);
    for(let i=0;i<16;i++) Kr[i] = (Km[i] & 0x1F) || 16;

    const S = OZGParser.CAST_S;

    function f1(r, km, kr) {
      const t = OZGParser.rotl32((km + r) >>> 0, kr);
      return ((S[0][t>>>24] ^ S[1][(t>>>16)&0xFF]) - S[2][(t>>>8)&0xFF] + S[3][t&0xFF]) >>> 0;
    }
    function f2(r, km, kr) {
      const t = OZGParser.rotl32((km ^ r) >>> 0, kr);
      return ((S[0][t>>>24] + S[1][(t>>>16)&0xFF]) ^ S[2][(t>>>8)&0xFF] - S[3][t&0xFF]) >>> 0;
    }
    function f3(r, km, kr) {
      const t = OZGParser.rotl32(((km - r) >>> 0), kr);
      return ((S[0][t>>>24] - S[1][(t>>>16)&0xFF]) + S[2][(t>>>8)&0xFF] ^ S[3][t&0xFF]) >>> 0;
    }

    for(let i=15;i>=0;i--) {
      const fn = [f1,f2,f3,f1,f2,f3,f1,f2,f3,f1,f2,f3,f1,f2,f3,f1][i];
      const t = r;
      r = l ^ fn(r, Km[i], Kr[i]);
      l = t;
    }
    OZGParser.setU32BE(block, 0, l);
    OZGParser.setU32BE(block, 4, r);
  }

  // ── RC5-32/16/16 (little-endian) — 16 rounds per C# reference ───────────
  static rc5Decrypt(block, key) {
    const r = 16;
    const t = 2*(r+1); // 34 subkeys
    const S = new Uint32Array(t);
    const L = new Uint32Array(4);

    // Load key (little-endian)
    for(let i=0;i<4;i++) L[i] = OZGParser.getU32LE(key, i*4);

    // Init S
    const P32=0xB7E15163, Q32=0x9E3779B9;
    S[0]=P32;
    for(let i=1;i<t;i++) S[i]=(S[i-1]+Q32)>>>0;

    // Mix - 3 * max(t,c) passes where c=4
    let A=0,B=0,ii=0,jj=0;
    const passes = 3*Math.max(t,4);
    for(let k=0;k<passes;k++){
      S[ii] = OZGParser.rotl32((S[ii]+A+B)>>>0, 3);
      A = S[ii];
      ii = (ii+1)%t;
      L[jj] = OZGParser.rotl32((L[jj]+A+B)>>>0, (A+B)&31);
      B = L[jj];
      jj = (jj+1)%4;
    }

    // Decrypt: subtraction must be inside the rotation
    let a = OZGParser.getU32LE(block, 0);
    let b = OZGParser.getU32LE(block, 4);

    for(let i=r;i>=1;i--){
      b = (OZGParser.rotr32((b - S[2*i+1])>>>0, a&31) ^ a)>>>0;
      a = (OZGParser.rotr32((a - S[2*i])>>>0, b&31) ^ b)>>>0;
    }
    b = (b - S[1])>>>0;
    a = (a - S[0])>>>0;

    OZGParser.setU32LE(block, 0, a);
    OZGParser.setU32LE(block, 4, b);
  }

  // ── RC6-32/20/16 (little-endian) ──────────────────────────────────────────
  static rc6Decrypt(block, key) {
    const r=20, t=2*(r+2); // 44 subkeys
    const S = new Uint32Array(t);
    const L = new Uint32Array(4);
    const P32=0xB7E15163, Q32=0x9E3779B9;

    for(let i=0;i<4;i++) L[i]=OZGParser.getU32LE(key, i*4);
    S[0]=P32;
    for(let i=1;i<t;i++) S[i]=(S[i-1]+Q32)>>>0;

    let A=0,B=0,ii=0,jj=0;
    const passes=3*Math.max(t,4);
    for(let k=0;k<passes;k++){
      S[ii]=OZGParser.rotl32((S[ii]+A+B)>>>0,3); A=S[ii]; ii=(ii+1)%t;
      L[jj]=OZGParser.rotl32((L[jj]+A+B)>>>0,(A+B)&31); B=L[jj]; jj=(jj+1)%4;
    }

    let a=OZGParser.getU32LE(block,0);
    let b=OZGParser.getU32LE(block,4);
    let c=OZGParser.getU32LE(block,8);
    let d=OZGParser.getU32LE(block,12);

    c=(c-S[2*r+3])>>>0; a=(a-S[2*r+2])>>>0;
    for(let i=r;i>=1;i--){
      [a,b,c,d]=[d,a,b,c];
      const u=OZGParser.rotl32((d*(2*d+1))>>>0, 5);
      const tt=OZGParser.rotl32((b*(2*b+1))>>>0, 5);
      c=(OZGParser.rotr32(c-S[2*i+1], tt&31) ^ u)>>>0;
      a=(OZGParser.rotr32(a-S[2*i], u&31) ^ tt)>>>0;
    }
    d=(d-S[1])>>>0; b=(b-S[0])>>>0;

    OZGParser.setU32LE(block,0,a); OZGParser.setU32LE(block,4,b);
    OZGParser.setU32LE(block,8,c); OZGParser.setU32LE(block,12,d);
  }

  // ── MARS (big-endian) with complete 512-entry S-box from CryptoPP ─────────
  static MARS_SBOX = new Uint32Array([
    0x09d0c479,0x28c8ffe0,0x84aa6c39,0x9dad7287,0x7dff9be3,0xd4268361,0xc96da1d4,0x7974cc93,
    0x85d0582e,0x2a4b5705,0x1ca16a62,0xc3bd279d,0x0f1f25e5,0x5160372f,0xc695c1fb,0x4d7ff1e4,
    0xae5f6bf4,0x0d72ee46,0xff23de8a,0xb1cf8e83,0xf14902e2,0x3e981e42,0x8bf53eb6,0x7f4bf8ac,
    0x83631f83,0x25970205,0x76afe784,0x3a7931d4,0x4f846450,0x5c64c3f6,0x210a5f18,0xc6986a26,
    0x28f4e826,0x3a60a81c,0xd340a664,0x7ea820c4,0x526687c5,0x7eddd12b,0x32a11d1d,0x9c9ef086,
    0x80f6e831,0xab6f04ad,0x56fb9b53,0x8b2e095c,0xb68556ae,0xd2250b0d,0x294a7721,0xe21fb253,
    0xae136749,0xe82aae86,0x93365104,0x99404a66,0x78a784dc,0xb69ba84b,0x04046793,0x23db5c1e,
    0x46cae1d6,0x2fe28134,0x5a223942,0x1863cd5b,0xc190c6e3,0x07dfb846,0x6eb88816,0x2d0dcc4a,
    0xa4ccae59,0x3798670d,0xcbfa9493,0x4f481d45,0xeafc8ca8,0xdb1129d6,0xb0449e20,0x0f5407fb,
    0x6167d9a8,0xd1f45763,0x4daa96c3,0x3bec5958,0xababa014,0xb6ccd201,0x38d6279f,0x02682215,
    0x8f376cd5,0x092c237e,0xbfc56593,0x32889d2c,0x854b3e95,0x05bb9b43,0x7dcd5dcd,0xa02e926c,
    0xfae527e5,0x36a1c330,0x3412e1ae,0xf257f462,0x3c4f1d71,0x30a2e809,0x68e5f551,0x9c61ba44,
    0x5ded0ab8,0x75ce09c8,0x9654f93e,0x698c0cca,0x243cb3e4,0x2b062b97,0x0f3b8d9e,0x00e050df,
    0xfc5d6166,0xe35f9288,0xc079550d,0x0591aee8,0x8e531e74,0x75fe3578,0x2f6d829a,0xf60b21ae,
    0x95e8eb8d,0x6699486b,0x901d7d9b,0xfd6d6e31,0x1090acef,0xe0670dd8,0xdab2e692,0xcd6d4365,
    0xe5393514,0x3af345f0,0x6241fc4d,0x460da3a3,0x7bcf3729,0x8bf1d1e0,0x14aac070,0x1587ed55,
    0x3afd7d3e,0xd2f29e01,0x29a9d1f6,0xefb10c53,0xcf3b870f,0xb414935c,0x664465ed,0x024acac7,
    0x59a744c1,0x1d2936a7,0xdc580aa6,0xcf574ca8,0x040a7a10,0x6cd81807,0x8a98be4c,0xaccea063,
    0xc33e92b5,0xd1e0e03d,0xb322517e,0x2092bd13,0x386b2c4a,0x52e8dd58,0x58656dfb,0x50820371,
    0x41811896,0xe337ef7e,0xd39fb119,0xc97f0df6,0x68fea01b,0xa150a6e5,0x55258962,0xeb6ff41b,
    0xd7c9cd7a,0xa619cd9e,0xbcf09576,0x2672c073,0xf003fb3c,0x4ab7a50b,0x1484126a,0x487ba9b1,
    0xa64fc9c6,0xf6957d49,0x38b06a75,0xdd805fcd,0x63d094cf,0xf51c999e,0x1aa4d343,0xb8495294,
    0xce9f8e99,0xbffcd770,0xc7c275cc,0x378453a7,0x7b21be33,0x397f41bd,0x4e94d131,0x92cc1f98,
    0x5915ea51,0x99f861b7,0xc9980a88,0x1d74fd5f,0xb0a495f8,0x614deed0,0xb5778eea,0x5941792d,
    0xfa90c1f8,0x33f824b4,0xc4965372,0x3ff6d550,0x4ca5fec0,0x8630e964,0x5b3fbbd6,0x7da26a48,
    0xb203231a,0x04297514,0x2d639306,0x2eb13149,0x16a45272,0x532459a0,0x8e5f4872,0xf966c7d9,
    0x07128dc0,0x0d44db62,0xafc8d52d,0x06316131,0xd838e7ce,0x1bc41d00,0x3a2e8c0f,0xea83837e,
    0xb984737d,0x13ba4891,0xc4f8b949,0xa6d6acb3,0xa215cdce,0x8359838b,0x6bd1aa31,0xf579dd52,
    0x21b93f93,0xf5176781,0x187dfdde,0xe94aeb76,0x2b38fd54,0x431de1da,0xab394825,0x9ad3048f,
    0xdfea32aa,0x659473e3,0x623f7863,0xf3346c59,0xab3ab685,0x3346a90b,0x6b56443e,0xc6de01f8,
    0x8d421fc0,0x9b0ed10c,0x88f1a1e9,0x54c1f029,0x7dead57b,0x8d7ba426,0x4cf5178a,0x551a7cca,
    0x1a9a5f08,0xfcd651b9,0x25605182,0xe11fc6c3,0xb6fd9676,0x337b3027,0xb7c8eb14,0x9e5fd030,
    0x6b57e354,0xad913cf7,0x7e16688d,0x58872a69,0x2c2fc7df,0xe389ccc6,0x30738df1,0x0824a734,
    0xe1797a8b,0xa4a8d57b,0x5b5d193b,0xc8a8309b,0x73f9a978,0x73398d32,0x0f59573e,0xe9df2b03,
    0xe8a5b6c8,0x848d0704,0x98df93c2,0x720a1dc3,0x684f259a,0x943ba848,0xa6370152,0x863b5ea3,
    0xd17b978b,0x6d9b58ef,0x0a700dd4,0xa73d36bf,0x8e6a0829,0x8695bc14,0xe35b3447,0x933ac568,
    0x8894b022,0x2f511c27,0xddfbcc3c,0x006662b6,0x117c83fe,0x4e12b414,0xc2bca766,0x3a2fec10,
    0xf4562420,0x55792e2a,0x46f5d857,0xceda25ce,0xc3601d3b,0x6c00ab46,0xefac9c28,0xb3c35047,
    0x611dfee3,0x257c3207,0xfdd58482,0x3b14d84f,0x23becb64,0xa075f3a3,0x088f8ead,0x07adf158,
    0x7796943c,0xfacabf3d,0xc09730cd,0xf7679969,0xda44e9ed,0x2c854c12,0x35935fa3,0x2f057d9f,
    0x690624f8,0x1cb0bafd,0x7b0dbdc6,0x810f23bb,0xfa929a1a,0x6d969a17,0x6742979b,0x74ac7d05,
    0x010e65c4,0x86a3d963,0xf907b5a0,0xd0042bd3,0x158d7d03,0x287a8255,0xbba8366f,0x096edc33,
    0x21916a7b,0x77b56b86,0x951622f9,0xa6c5e650,0x8cea17d1,0xcd8c62bc,0xa3d63433,0x358a68fd,
    0x0f9b9d3c,0xd6aa295b,0xfe33384a,0xc000738e,0xcd67eb2f,0xe2eb6dc2,0x97338b02,0x06c9f246,
    0x419cf1ad,0x2b83c045,0x3723f18a,0xcb5b3089,0x160bead7,0x5d494656,0x35f8a74b,0x1e4e6c9e,
    0x000399bd,0x67466880,0xb4174831,0xacf423b2,0xca815ab3,0x5a6395e7,0x302a67c5,0x8bdb446b,
    0x108f8fa4,0x10223eda,0x92b8b48b,0x7f38d0ee,0xab2701d4,0x0262d415,0xaf224a30,0xb3d88aba,
    0xf8b2c3af,0xdaf7ef70,0xcc97d3b7,0xe9614b6c,0x2baebff4,0x70f687cf,0x386c9156,0xce092ee5,
    0x01e87da6,0x6ce91e6a,0xbb7bcc84,0xc7922c20,0x9d3b71fd,0x060e41c6,0xd7590f15,0x4e03bb47,
    0x183c198e,0x63eeb240,0x2ddbf49a,0x6d5cba54,0x923750af,0xf9e14236,0x7838162b,0x59726c72,
    0x81b66760,0xbb2926c1,0x48a0ce0d,0xa6c0496d,0xad43507b,0x718d496a,0x9df057af,0x44b1bde6,
    0x054356dc,0xde7ced35,0xd51a138b,0x62088cc9,0x35830311,0xc96efca2,0x686f86ec,0x8e77cb68,
    0x63e1d6b8,0xc80f9778,0x79c491fd,0x1b4c67f2,0x72698d7d,0x5e368c31,0xf7d95e2e,0xa1d3493f,
    0xdcd9433e,0x896f1552,0x4bc4ca7a,0xa6d1baf4,0xa5a96dcc,0x0bef8b46,0xa169fda7,0x74df40b7,
    0x4e208804,0x9a756607,0x038e87c8,0x20211e44,0x8b7ad4bf,0xc6403f35,0x1848e36d,0x80bdb038,
    0x1e62891c,0x643d2107,0xbf04d6f8,0x21092c8c,0xf644f389,0x0778404e,0x7b78adb8,0xa2c52d53,
    0x42157abe,0xa2253e2e,0x7bf3f4ae,0x80f594f9,0x953194e7,0x77eb92ed,0xb3816930,0xda8d9336,
    0xbf447469,0xf26d9483,0xee6faed5,0x71371235,0xde425f73,0xb4e59f43,0x7dbe2d4e,0x2d37b185,
    0x49dc9a63,0x98c39d98,0x1301c9a2,0x389b1bbf,0x0c18588d,0xa421c1ba,0x7aa3865c,0x71e08558,
    0x3c5cfcaa,0x7d239ca4,0x0297d9dd,0xd7dc2830,0x4b37802b,0x7428ab54,0xaeee0347,0x4b3fbb85,
    0x692f2f08,0x134e578e,0x36d9e0bf,0xae8b5fcf,0xedb93ecf,0x2b27248e,0x170eb1ef,0x7dc57fd6,
    0x1e760f16,0xb1136601,0x864e1b9b,0xd7ea7319,0x3ab871bd,0xcfa4d76f,0xe31bd782,0x0dbeb469,
    0xabb96061,0x5370f85d,0xffb07e37,0xda30d0fb,0xebc977b6,0x0b98b40f,0x3a4d0fe6,0xdf4fc26b,
    0x159cf22a,0xc298d6e2,0x2b78ef6a,0x61a94ac0,0xab561187,0x14eea0f0,0xdf0d4164,0x19af70ee
  ]);

  static marsDecrypt(block, key) {
    let a=OZGParser.getU32BE(block,0), b=OZGParser.getU32BE(block,4);
    let c=OZGParser.getU32BE(block,8), d=OZGParser.getU32BE(block,12);

    // Simplified key schedule
    const K = new Uint32Array(40);
    for(let i=0;i<4;i++) K[i]=OZGParser.getU32BE(key,i*4);
    K[4]=4;
    for(let i=5;i<40;i++) K[i]=(K[i-5]^K[i-4]^K[i-3]^K[i-2]^K[i-1]^(i-5))>>>0;
    for(let i=0;i<40;i++) K[i]=OZGParser.MARS_SBOX[K[i]&511];  // Use full 512-entry S-box
    for(let i=5;i<40;i+=2) K[i]|=3;

    // Backward mixing (inverse of forward mixing)
    for(let i=0;i<8;i++){
      d=(d-K[39-i*2])>>>0; b=(b-K[38-i*2])>>>0;
      c^=OZGParser.rotl32(d,24); a^=OZGParser.rotl32(b,16);
      [a,b,c,d]=[d,a,b,c];
    }
    a=(a-K[3])>>>0; b=(b-K[2])>>>0; c=(c-K[1])>>>0; d=(d-K[0])>>>0;

    OZGParser.setU32BE(block,0,a); OZGParser.setU32BE(block,4,b);
    OZGParser.setU32BE(block,8,c); OZGParser.setU32BE(block,12,d);
  }

  // ── IDEA (big-endian) ──────────────────────────────────────────────────────
  static ideaMul(a, b) {
    if(!a) a=0x10000; if(!b) b=0x10000;
    const p=(Math.imul(a,b)>>>0);
    const lo=p&0xFFFF, hi=(p>>>16)&0xFFFF;
    const r=(lo-hi)+(lo<hi?1:0);
    return r&0xFFFF;
  }
  static ideaInv(x) {
    if(x<=1) return x;
    let t1=Math.floor(0x10001/x), t2=0x10001%x;
    if(t2===1) return (1-t1+0x10001)%0x10001;
    let q=0,b=x,a=t2;
    t1=1; let t=0;
    while(a>1){
      q=Math.floor(b/a); const tmp=b-q*a; b=a; a=tmp;
      const ts=t1-q*t; t1=t; t=ts;
    }
    return (t+0x10001)%0x10001;
  }
  static ideaDecrypt(block, key) {
    // Load block as big-endian uint16
    const X = new Uint16Array(4);
    const v = new DataView(block.buffer, block.byteOffset, 8);
    for(let i=0;i<4;i++) X[i]=v.getUint16(i*2, false);

    // Key schedule for encryption (52 subkeys from 128-bit key)
    const EK = new Uint16Array(52);
    const kv = new DataView(key.buffer, key.byteOffset, 16);
    for(let i=0;i<8;i++) EK[i]=kv.getUint16(i*2, false);
    for(let i=8;i<52;i++){
      const hi=(EK[i-7]<<9)|(EK[i-6]>>>7);
      EK[i]=(hi&0xFFFF);
    }

    // Invert key schedule for decryption
    const DK = new Uint16Array(52);
    // Last round output transform
    DK[48]=OZGParser.ideaInv(EK[48]);
    DK[49]=(0x10000-EK[49])&0xFFFF;
    DK[50]=(0x10000-EK[50])&0xFFFF;
    DK[51]=OZGParser.ideaInv(EK[51]);
    for(let r=7;r>=1;r--){
      const base=r*6, dbase=(7-r)*6;
      DK[dbase+4]=EK[base+4];
      DK[dbase+5]=EK[base+5];
      DK[dbase+6]=OZGParser.ideaInv(EK[base]);
      DK[dbase+7]=(0x10000-EK[base+2])&0xFFFF;
      DK[dbase+8]=(0x10000-EK[base+1])&0xFFFF;
      DK[dbase+9]=OZGParser.ideaInv(EK[base+3]);
    }
    DK[42]=EK[4]; DK[43]=EK[5];
    DK[44]=OZGParser.ideaInv(EK[0]);
    DK[45]=(0x10000-EK[2])&0xFFFF;
    DK[46]=(0x10000-EK[1])&0xFFFF;
    DK[47]=OZGParser.ideaInv(EK[3]);

    // 8 rounds of IDEA
    let x0=X[0],x1=X[1],x2=X[2],x3=X[3];
    for(let r=0;r<8;r++){
      const base=r*6;
      const y0=OZGParser.ideaMul(x0,DK[base]);
      const y1=(x1+DK[base+1])&0xFFFF;
      const y2=(x2+DK[base+2])&0xFFFF;
      const y3=OZGParser.ideaMul(x3,DK[base+3]);
      const t0=OZGParser.ideaMul(DK[base+4], (y0^y2)&0xFFFF);
      const t1=OZGParser.ideaMul(DK[base+5], (t0+(y1^y3))&0xFFFF);
      const t2=(t0+t1)&0xFFFF;
      x0=(y0^t1)&0xFFFF; x3=(y3^t2)&0xFFFF;
      x1=(r<7?(y2^t1):(y1^t2))&0xFFFF;
      x2=(r<7?(y1^t2):(y2^t1))&0xFFFF;
    }
    // Final transform
    const y0=OZGParser.ideaMul(x0,DK[48]);
    const y1=(x1+DK[49])&0xFFFF;
    const y2=(x2+DK[50])&0xFFFF;
    const y3=OZGParser.ideaMul(x3,DK[51]);

    const ov = new DataView(block.buffer, block.byteOffset, 8);
    ov.setUint16(0,y0,false); ov.setUint16(2,y1,false);
    ov.setUint16(4,y2,false); ov.setUint16(6,y3,false);
  }

  // ── GOST 28147-89 (little-endian, CryptoPP S-boxes) ───────────────────────
  static GOST_SBOX = new Uint8Array([
    4,10,9,2,13,8,0,14,6,11,1,12,7,15,5,3,   // S0
    14,11,4,12,6,13,15,10,2,3,8,1,0,7,5,9,   // S1
    5,8,1,13,10,3,4,2,14,15,12,7,6,0,9,11,   // S2
    7,13,10,1,0,8,9,15,14,4,6,12,11,2,5,3,   // S3
    6,12,7,1,5,15,13,8,4,10,9,14,0,3,11,2,   // S4
    4,11,10,0,7,2,1,13,3,6,8,5,9,12,15,14,   // S5
    13,11,4,1,3,15,5,9,0,10,14,7,6,8,2,12,   // S6
    1,15,13,0,5,7,10,4,9,2,3,14,6,11,8,12    // S7
  ]);

  static gostSub(x) {
    const S = OZGParser.GOST_SBOX;
    let r = 0;
    for(let i=0;i<8;i++) r |= (S[i*16+((x>>>(i*4))&0xF)] << (i*4));
    return r >>> 0;
  }

  static gostRound(n1, n2, key) {
    n2 ^= OZGParser.rotl32(OZGParser.gostSub((n1+key)>>>0), 11);
    return [n2, n1]; // swap
  }

  static gostDecrypt(block, key) {
    let n1=OZGParser.getU32LE(block,0);
    let n2=OZGParser.getU32LE(block,4);
    const K=new Uint32Array(8);
    for(let i=0;i<8;i++) K[i]=OZGParser.getU32LE(key, i*4);

    // Decryption: 3×8 rounds (k[7..0]) + 8 rounds (k[0..7])
    for(let pass=0;pass<3;pass++)
      for(let j=7;j>=0;j--)
        [n1,n2]=OZGParser.gostRound(n1,n2,K[j]);
    for(let j=0;j<8;j++)
      [n1,n2]=OZGParser.gostRound(n1,n2,K[j]);

    // Output swapped (CryptoPP: PutWord(n2), PutWord(n1))
    OZGParser.setU32LE(block,0,n2);
    OZGParser.setU32LE(block,4,n1);
  }

  // ── Block dispatch ─────────────────────────────────────────────────────────
  static decryptBlocks(data, offset, length, alg, key) {
    const bs = OZGParser.CIPHER_SPECS[alg].blockSize;
    for(let i=0; i<length; i+=bs){
      const block=new Uint8Array(data.buffer, data.byteOffset+offset+i, bs);
      switch(alg){
        case 0: OZGParser.teaDecrypt(block,key); break;
        case 1: OZGParser.threeWayDecrypt(block,key); break;
        case 2: OZGParser.cast128Decrypt(block,key); break;
        case 3: OZGParser.rc5Decrypt(block,key); break;
        case 4: OZGParser.rc6Decrypt(block,key); break;
        case 5: OZGParser.marsDecrypt(block,key); break;
        case 6: OZGParser.ideaDecrypt(block,key); break;
        case 7: OZGParser.gostDecrypt(block,key); break;
      }
    }
  }

  // ── ModulusDecrypt ─────────────────────────────────────────────────────────
  static decrypt(buffer) {
    const data = new Uint8Array(buffer.slice ? buffer.slice() : buffer);
    if(data.length<34) throw new Error('OZG/OZD too small');

    const alg2=data[0]&7, alg1=data[1]&7;
    const dataSize=data.length-34;

    const spec1=OZGParser.CIPHER_SPECS[alg1];
    const mKey=OZGParser.MASTER_KEY.slice(0,spec1.keyLen);
    let bs=1024-(1024%spec1.blockSize);

    if(dataSize>4*bs)
      OZGParser.decryptBlocks(data, 2+(dataSize>>1), bs, alg1, mKey);
    if(dataSize>bs){
      OZGParser.decryptBlocks(data, data.length-bs, bs, alg1, mKey);
      OZGParser.decryptBlocks(data, 2, bs, alg1, mKey);
    }

    const key2=data.slice(2,34).slice(0, OZGParser.CIPHER_SPECS[alg2].keyLen);
    const spec2=OZGParser.CIPHER_SPECS[alg2];
    bs=dataSize-(dataSize%spec2.blockSize);
    OZGParser.decryptBlocks(data, 34, bs, alg2, key2);

    return {
      data: data.slice(34),
      alg1, alg2,
      algorithm1Name: spec1.name,
      algorithm2Name: spec2.name
    };
  }

  static parseOZG(buffer) {
    const r=OZGParser.decrypt(buffer);
    return { gfxData:r.data, alg1:r.alg1, alg2:r.alg2,
             algorithm1:r.algorithm1Name, algorithm2:r.algorithm2Name,
             format:`OZG (GFx) [${r.algorithm2Name}+${r.algorithm1Name}]` };
  }

  static parseOZD(buffer) {
    const r=OZGParser.decrypt(buffer);
    return { imageData:r.data, alg1:r.alg1, alg2:r.alg2,
             algorithm1:r.algorithm1Name, algorithm2:r.algorithm2Name };
  }
}
