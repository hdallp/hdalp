/**
 * Effect Lab - Custom GLSL and WGSL Shaders for 3D Gaussian Splats
 */

// 0. gsplatVS: Custom vertex shader with adaptive voxel grid & random density decimation
const customVSGLSL = `
#ifdef GSPLAT_USER_VARYINGS
	#include "gsplatUserVaryingsVS"
#endif
#include "gsplatCommonVS"
varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;
varying vec3 vModelCenter;
varying float vSplatIndex;
#ifndef DITHER_NONE
	varying float id;
#endif
mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);
#ifdef PREPASS_PASS
	varying float vLinearDepth;
#endif
#if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
	flat varying uint vPickId;
#endif
#ifdef GSPLAT_OVERDRAW
	uniform sampler2D colorRamp;
	uniform float colorRampIntensity;
#endif

uniform float uDensity;
uniform float uEvenDensity;
uniform float uModelRadius;
uniform vec3 uModelCenter;
uniform float uMinOpacity;
uniform float uLockSH;
uniform float uBakePass;      // 1 = passe de bake: cada splat desenha 1 texel do mapa
uniform vec3 uLockSHCamPos;   // camera congelada no espaco do modelo (Fixar Harmonicos)
uniform int uRenderMode;

uint hashUintVS(uint x) {
	x ^= (x >> 16u);
	x *= 0x45d9f3bu;
	x ^= (x >> 16u);
	x *= 0x45d9f3bu;
	x ^= (x >> 16u);
	return x;
}

float splatRandomRank(uint idx) {
	return float(hashUintVS(idx)) / 4294967296.0;
}

void main(void) {
	SplatSource source;
	if (!initSource(source)) {
		gl_Position = discardVec;
		return;
	}

	vec3 modelCenter = getCenter();
	vModelCenter = modelCenter;
	vSplatIndex = float(splat.index);

	if (uDensity < 0.999 && uBakePass < 0.5) {
		if (uEvenDensity > 0.5) {
			// --- Modo Distribuição Uniforme (Espacialmente Estável - Sem Flicker) ---
			float rad = max(0.05, uModelRadius);
			float cellSize = rad * 0.03;
			vec3 cPos = (modelCenter - uModelCenter) / cellSize;
			ivec3 cell = ivec3(floor(cPos));
			uint cellHash = uint(cell.x) * 73856093u ^ uint(cell.y) * 19349663u ^ uint(cell.z) * 83492791u;
			uint h = splat.index ^ cellHash;
			float spatialRank = float(hashUintVS(h)) / 4294967296.0;
			if (spatialRank > uDensity) {
				gl_Position = discardVec;
				return;
			}
		} else {
			// --- Modo Aleatório Estável (Monotônico, determinístico por splat.index - ZERO flicker) ---
			float randVal = splatRandomRank(splat.index);
			if (randVal > uDensity) {
				gl_Position = discardVec;
				return;
			}
		}
	}

	SplatCenter center;
	center.modelCenterOriginal = modelCenter;
	
	modifySplatCenter(modelCenter);
	center.modelCenterModified = modelCenter;
	if (!initCenter(modelCenter, center)) {
		gl_Position = discardVec;
		return;
	}
	SplatCorner corner;
	if (!initCorner(source, center, corner)) {
		gl_Position = discardVec;
		return;
	}
	#ifdef GSPLAT_SEPARATE_OPACITY
		float opacity = getOpacity();
		vec4 clr = vec4(getColor(), opacity);
	#else
		vec4 clr = getColor();
	#endif
	#if GSPLAT_AA
		clr.a *= corner.aaFactor;
	#endif
	#if SH_BANDS > 0
		vec3 dir;
		if (uLockSH > 0.5) {
			dir = normalize(modelCenter - uLockSHCamPos);
		} else if (uRenderMode != 2) {
			// No modo Emoji (0, 1, 3, 4), fixa a direção dos harmônicos para estabilidade total de cor (zero flicker ao girar)
			dir = vec3(0.0, 0.0, 1.0);
		} else {
			dir = normalize(center.view * mat3(center.modelView));
		}
		vec3 sh[SH_COEFFS];
		float scale;
		readSHData(sh, scale);
		clr.xyz += evalSH(sh, dir) * scale;
	#endif
	modifySplatColor(modelCenter, clr);

	if (clr.w < uMinOpacity && uBakePass < 0.5) {
		gl_Position = discardVec;
		return;
	}

	#if GSPLAT_2DGS
		vec3 modelCorner = center.modelCenterModified + corner.offset;
		gl_Position = matrix_projection * center.modelView * vec4(modelCorner, 1.0);
	#else
		gl_Position = center.proj + vec4(corner.offset.xyz, 0);
	#endif

	// Desempate determinístico estável na profundidade (elimina Z-fighting e alternância de ordem de sorteio)
	float depthTie = (float(splat.index % 1024u) - 512.0) * 1e-7;
	gl_Position.z += depthTie * gl_Position.w;
	gaussianUV = source.cornerUV;

	if (uBakePass > 0.5) {
		float bIdx = float(splat.index);
		vec2 bc = vec2(
			(mod(bIdx, uPinMapParams.x) + 0.5) * uPinMapParams.z * 2.0 - 1.0,
			(floor(bIdx * uPinMapParams.z) + 0.5) * uPinMapParams.w * 2.0 - 1.0
		);
		gl_Position = vec4(bc + source.cornerUV * uPinMapParams.zw, 0.0, 1.0);
	}

	#ifdef GSPLAT_OVERDRAW
		float t = clamp(modelCenter.y / 20.0, 0.0, 1.0);
		vec3 rampColor = textureLod(colorRamp, vec2(t, 0.5), 0.0).rgb;
		clr.a *= (1.0 / 32.0) * colorRampIntensity;
		gaussianColor = vec4(rampColor, clr.a);
	#else
		gaussianColor = vec4(prepareOutputFromGamma(max(clr.xyz, 0.0), -center.view.z), clr.w);
	#endif
	#ifndef DITHER_NONE
		id = float(splat.index);
	#endif
	#ifdef PREPASS_PASS
		vLinearDepth = -center.view.z;
	#endif
	#if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
		vPickId = loadPcId().r;
	#endif
}
`;

// 1. gsplatCornerVS: Quadrados Billboard sem rotação / com orientação por normal
const customCornerVSGLSL = `
uniform float uSquareSize;
uniform float uDepthThreshold;
uniform float uMinDepth;
uniform float uMaxDepth;
uniform sampler2D uPinMap;
uniform vec4 uPinMapParams;    // (width, height, 1/width, 1/height)
uniform float uPinEmojiScale;  // multiplica o quadrado dos splats fixados
uniform float uSurfaceOrient;  // 1 = emoji gira conforme a normal da superficie
uniform float uSurfaceSkew;    // 1 = deita o emoji na superficie (sofre encurtamento)
uniform float uRotBake;        // 1 = rotação do emoji CONGELADA (bake)
uniform vec3 uBakeRight;       // base da câmera congelada (espaço do modelo)
uniform vec3 uBakeUp;

float pinnedEmojiScale(uint splatIndex) {
	float pinIdx = float(splatIndex);
	vec2 pinUV = (vec2(mod(pinIdx, uPinMapParams.x), floor(pinIdx * uPinMapParams.z)) + 0.5) * uPinMapParams.zw;
	if (texture2D(uPinMap, pinUV).b > 0.5) {
		return max(1.0, uPinEmojiScale);
	}
	return 1.0;
}

vec3 outwardSplatNormal(vec3 splatPos) {
	vec4 rot = getRotation();
	vec3 scl = getScale();
	mat3 basis = quatToMat3(rot);
	vec3 n;
	if (scl.x <= scl.y && scl.x <= scl.z) {
		n = basis[0];
	} else if (scl.y <= scl.z) {
		n = basis[1];
	} else {
		n = basis[2];
	}
	n = normalize(n);
	if (dot(n, splatPos) < 0.0) {
		n = -n;
	}
	return n;
}

void computeCovariance(vec4 rotation, vec3 scale, out vec3 covA, out vec3 covB) {
	covA = vec3(0.0);
	covB = vec3(0.0);
}

bool initCornerCov(SplatSource source, SplatCenter center, out SplatCorner corner, vec3 covA, vec3 covB) {
	return true;
}

bool initCorner(SplatSource source, SplatCenter center, out SplatCorner corner) {
	float depth = -center.view.z;
	if (uDepthThreshold < 0.999) {
		float depthRange = max(0.001, uMaxDepth - uMinDepth);
		float normDepth = (depth - uMinDepth) / depthRange;
		if (normDepth > uDepthThreshold) {
			return false;
		}
	}

	float s = max(0.0001, uSquareSize) * pinnedEmojiScale(splat.index);

	if (uSurfaceOrient > 0.5) {
		vec3 n = outwardSplatNormal(center.modelCenterModified);
		vec3 nView = (center.modelView * vec4(n, 0.0)).xyz;

		if (uSurfaceSkew > 0.5) {
			vec3 nModel = normalize(n);
			mat3 vm = mat3(center.modelView);
			vec3 camRight = (uRotBake > 0.5) ? uBakeRight : vec3(vm[0][0], vm[1][0], vm[2][0]);
			vec3 camUp = (uRotBake > 0.5) ? uBakeUp : vec3(vm[0][1], vm[1][1], vm[2][1]);

			vec3 tangent = camRight - nModel * dot(camRight, nModel);
			if (dot(tangent, tangent) < 0.0001) {
				tangent = camUp - nModel * dot(camUp, nModel);
			}
			tangent = normalize(tangent);
			vec3 bitangent = cross(nModel, tangent);

			vec3 modelOffset = (tangent * source.cornerUV.x + bitangent * source.cornerUV.y) * s;
			corner.offset = (matrix_projection * center.modelView * vec4(modelOffset, 0.0)).xyz;
		} else {
			float theta = 0.0;
			if (uRotBake > 0.5) {
				vec3 nModel = normalize(n);
				theta = atan(-dot(nModel, uBakeRight), dot(nModel, uBakeUp));
			} else if (dot(nView.xy, nView.xy) > 0.0001) {
				theta = atan(-nView.x, nView.y);
			}
			float cs = cos(theta);
			float sn = sin(theta);
			vec2 uv = vec2(
				source.cornerUV.x * cs - source.cornerUV.y * sn,
				source.cornerUV.x * sn + source.cornerUV.y * cs
			);
			corner.offset = vec3(
				matrix_projection[0][0] * uv.x * s,
				matrix_projection[1][1] * uv.y * s,
				0.0
			);
		}
	} else {
		corner.offset = vec3(
			matrix_projection[0][0] * source.cornerUV.x * s,
			matrix_projection[1][1] * source.cornerUV.y * s,
			0.0
		);
	}

	corner.uv = source.cornerUV;
	#if GSPLAT_AA
		corner.aaFactor = 1.0;
	#endif
	return true;
}
`;

const customCornerVSWGSL = `
fn computeCovariance(rotation: vec4f, scale: vec3f, covA: ptr<function, vec3f>, covB: ptr<function, vec3f>) {
}

fn initCornerCov(source: ptr<function, SplatSource>, center: ptr<function, SplatCenter>, corner: ptr<function, SplatCorner>, covA: vec3f, covB: vec3f) -> bool {
	return true;
}

fn initCorner(source: ptr<function, SplatSource>, center: ptr<function, SplatCenter>, corner: ptr<function, SplatCorner>) -> bool {
	let depth: f32 = -(*center).view.z;
	if (uniforms.uDepthThreshold < 0.999) {
		let depthRange: f32 = max(0.001, uniforms.uMaxDepth - uniforms.uMinDepth);
		let normDepth: f32 = (depth - uniforms.uMinDepth) / depthRange;
		if (normDepth > uniforms.uDepthThreshold) {
			return false;
		}
	}

	let s: f32 = max(0.0001, uniforms.uSquareSize);
	(*corner).offset = vec3f(
		uniforms.matrix_projection[0][0] * (*source).cornerUV.x * s,
		uniforms.matrix_projection[1][1] * (*source).cornerUV.y * s,
		0.0
	);
	(*corner).uv = (*source).cornerUV;
	#if GSPLAT_AA
		(*corner).aaFactor = 1.0;
	#endif
	return true;
}
`;

// 2. gsplatPS: Amostragem precisa e orientada do Emoji Atlas + Pinned Points + Position Pass
const customPSGLSL = `
varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;
varying vec3 vModelCenter;
varying float vSplatIndex;

#if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
	flat varying uint vPickId;
#endif
#ifdef PICK_PASS
	#include "pickPS"
#endif

uniform sampler2D uEmojiAtlas;
uniform sampler2D uColorLUT;
uniform int uRenderMode;
uniform int uDistMode;
uniform float uEmojiVariety;
uniform float uAlphaCutoff;
uniform float uTintIntensity;
uniform float uModelRadius;
uniform vec3 uModelCenter;

uniform float uHueShift;
uniform float uSaturation;
uniform float uBrightness;
uniform float uContrast;
uniform float uGamma;

// Mapa de pins: 1 texel por splat -> (col, row, ativo, ativo)
uniform sampler2D uPinMap;
uniform vec4 uPinMapParams;   // (width, height, 1/width, 1/height)

// Bake de cor/emoji: mapa por splat (1 texel) com o slot congelado
uniform float uBakePass;
uniform float uBakeOn;
uniform sampler2D uBakeMap;

vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 applyColorGrading(vec3 col) {
	vec3 hsv = rgb2hsv(clamp(col, 0.0, 1.0));
	hsv.x = fract(hsv.x + uHueShift / 360.0);
	hsv.y = clamp(hsv.y * uSaturation, 0.0, 1.0);
	vec3 rgb = hsv2rgb(hsv);

	rgb = (rgb - 0.5) * uContrast + 0.5 + uBrightness;
	rgb = clamp(rgb, 0.0, 1.0);

	if (uGamma > 0.01 && abs(uGamma - 1.0) > 0.005) {
		rgb = pow(rgb, vec3(1.0 / uGamma));
	}
	return clamp(rgb, 0.0, 1.0);
}

uint hashUintPS(uint x) {
	x ^= (x >> 16u);
	x *= 0x45d9f3bu;
	x ^= (x >> 16u);
	x *= 0x45d9f3bu;
	x ^= (x >> 16u);
	return x;
}

void main(void) {
	#if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
		// pass
	#elif SHADOW_PASS
		gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
	#elif PREPASS_PASS
		pcFragColor0 = floatAsUint(vLinearDepth);
	#else
		vec3 splatColor = applyColorGrading(gaussianColor.rgb);

		if (uRenderMode == 2) {
			gl_FragColor = vec4(splatColor, 1.0);
			return;
		}

		if (uRenderMode == 4) {
			float idx = floor(vSplatIndex + 0.5);
			float r = mod(idx, 256.0) / 255.0;
			float g = mod(floor(idx / 256.0), 256.0) / 255.0;
			float b = mod(floor(idx / 65536.0), 256.0) / 255.0;
			gl_FragColor = vec4(r, g, b, 1.0);
			return;
		}

		vec2 localUV = vec2(gaussianUV.x * 0.5 + 0.5, -gaussianUV.y * 0.5 + 0.5);
		vec2 clampedUV = clamp(localUV, 0.0, 1.0);

		vec3 voxel = clamp(floor(splatColor * 15.0 + 0.5), vec3(0.0), vec3(15.0));
		float lutX = (voxel.r * 16.0 + voxel.g + 0.5) / 256.0;
		float lutY = (voxel.b + 0.5) / 16.0;

		uint sIdx = uint(floor(vSplatIndex + 0.5));
		if (uDistMode == 2) {
			// Modo Aleatório: distribui splats uniformemente pela LUT baseado no índice exato do splat (zero flicker)
			uint h = hashUintPS(sIdx);
			float randVoxel = mod(float(h), 4096.0);
			lutX = (mod(randVoxel, 256.0) + 0.5) / 256.0;
			lutY = (floor(randVoxel / 256.0) + 0.5) / 16.0;
		} else if (uEmojiVariety > 0.05) {
			// Dither suave determinístico por splat index (zero flicker)
			uint h1 = hashUintPS(sIdx);
			uint h2 = hashUintPS(sIdx ^ 0x9e3779b9u);
			uint h3_u = hashUintPS(sIdx ^ 0x517cc1b7u);
			vec3 jitter = (vec3(float(h1)/4294967296.0, float(h2)/4294967296.0, float(h3_u)/4294967296.0) - 0.5) * (uEmojiVariety * 0.95);
			vec3 jitVoxel = clamp(floor(splatColor * 15.0 + jitter + 0.5), vec3(0.0), vec3(15.0));
			lutX = (jitVoxel.r * 16.0 + jitVoxel.g + 0.5) / 256.0;
			lutY = (jitVoxel.b + 0.5) / 16.0;
		}

		vec4 lutSample = texture2D(uColorLUT, vec2(lutX, lutY));
		float col = floor(lutSample.r * 255.0 + 0.5);
		float row = floor(lutSample.g * 255.0 + 0.5);

		// Override exato por splat
		{
			float pinIdx = floor(vSplatIndex + 0.5);
			vec2 pinUV = (vec2(mod(pinIdx, uPinMapParams.x), floor(pinIdx * uPinMapParams.z)) + 0.5) * uPinMapParams.zw;
			vec4 pinSample = texture2D(uPinMap, pinUV);
			if (pinSample.b > 0.5) {
				col = floor(pinSample.r * 255.0 + 0.5);
				row = floor(pinSample.g * 255.0 + 0.5);
			}
		}

		// Bake de cor/emoji
		if (uBakeOn > 0.5) {
			float bakedIdx = floor(vSplatIndex + 0.5);
			vec2 bakedUV = (vec2(mod(bakedIdx, uPinMapParams.x), floor(bakedIdx * uPinMapParams.z)) + 0.5) * uPinMapParams.zw;
			vec4 baked = texture2D(uBakeMap, bakedUV);
			if (baked.a > 0.5) {
				col = floor(baked.r * 255.0 + 0.5);
				row = floor(baked.g * 255.0 + 0.5);
			}
		}

		if (uBakePass > 0.5) {
			gl_FragColor = vec4(col / 255.0, row / 255.0, 1.0, 1.0);
			return;
		}

		float atlasU = (col + clampedUV.x) / 64.0;
		float atlasV = (row + clampedUV.y) / 32.0;

		vec4 emojiColor = texture2D(uEmojiAtlas, vec2(atlasU, atlasV));

		if (emojiColor.a < uAlphaCutoff) {
			discard;
		}

		if (uRenderMode == 3) {
			gl_FragColor = vec4(col / 255.0, row / 255.0, 0.5, 1.0);
			return;
		}

		if (uRenderMode == 0) {
			gl_FragColor = vec4(emojiColor.rgb, 1.0);
		} else {
			vec3 tinted = mix(emojiColor.rgb, emojiColor.rgb * splatColor * 1.5, uTintIntensity);
			gl_FragColor = vec4(tinted, 1.0);
		}
	#endif
}
`;

const customPSWGSL = `
varying gaussianUV: half2;
varying gaussianColor: half4;

#if defined(GSPLAT_UNIFIED_ID) && defined(PICK_PASS)
	varying @interpolate(flat) vPickId: u32;
#endif
#ifdef PICK_PASS
	#include "pickPS"
#endif

fn hashPosWG(p: vec3f) -> f32 {
	var p3 = fract(p * vec3f(443.897, 441.423, 437.195));
	p3 += dot(p3, p3.yzx + 19.19);
	return fract((p3.x + p3.y) * p3.z);
}

fn hashPos3WG(p: vec3f) -> vec3f {
	var p3 = fract(p * vec3f(443.897, 441.423, 437.195));
	p3 += dot(p3, p3.yzx + 19.19);
	return fract((p3.xxy + p3.yzz) * p3.zyx);
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
	var output: FragmentOutput;

	#if defined(SHADOW_PASS) || defined(PICK_PASS) || defined(PREPASS_PASS)
		// pass
	#elif SHADOW_PASS
		output.color0 = vec4f(0.0, 0.0, 0.0, 1.0);
	#elif PREPASS_PASS
		output.color0 = floatAsUint(input.vLinearDepth);
	#else
		let splatColor = clamp(vec3f(input.gaussianColor.rgb), vec3f(0.0), vec3f(1.0));

		if (uniforms.uRenderMode == 2) {
			output.color0 = vec4f(splatColor, 1.0);
			return output;
		}

		let localUV = vec2f(f32(input.gaussianUV.x) * 0.5 + 0.5, -f32(input.gaussianUV.y) * 0.5 + 0.5);
		let clampedUV = clamp(localUV, vec2f(0.0), vec2f(1.0));

		var voxel = clamp(floor(splatColor * 15.0 + 0.5), vec3f(0.0), vec3f(15.0));
		var lutX = (voxel.r * 16.0 + voxel.g + 0.5) / 256.0;
		var lutY = (voxel.b + 0.5) / 16.0;

		if (uniforms.uDistMode == 2) {
			let rnd = hashPosWG(vec3f(input.gaussianUV.x, input.gaussianUV.y, splatColor.r) * 80.0);
			let randVoxel = floor(rnd * 4095.0 + 0.5);
			lutX = (fract(randVoxel / 256.0) * 256.0 + 0.5) / 256.0;
			lutY = (floor(randVoxel / 256.0) + 0.5) / 16.0;
		} else if (uniforms.uEmojiVariety > 0.05) {
			let h3 = hashPos3WG(vec3f(input.gaussianUV.x, input.gaussianUV.y, splatColor.r) * 80.0) - 0.5;
			let jitter = h3 * (uniforms.uEmojiVariety * 0.95);
			let jitVoxel = clamp(floor(splatColor * 15.0 + jitter + 0.5), vec3f(0.0), vec3f(15.0));
			lutX = (jitVoxel.r * 16.0 + jitVoxel.g + 0.5) / 256.0;
			lutY = (jitVoxel.b + 0.5) / 16.0;
		}

		let lutSample = textureSample(uColorLUT, uColorLUTSampler, vec2f(lutX, lutY));
		let col = floor(lutSample.r * 255.0 + 0.5);
		let row = floor(lutSample.g * 255.0 + 0.5);

		let atlasU = (col + clampedUV.x) / 64.0;
		let atlasV = (row + clampedUV.y) / 32.0;

		let emojiColor = textureSample(uEmojiAtlas, uEmojiAtlasSampler, vec2f(atlasU, atlasV));
		if (emojiColor.a < uniforms.uAlphaCutoff) {
			discard;
		}

		if (uniforms.uRenderMode == 3) {
			output.color0 = vec4f(col / 255.0, row / 255.0, 0.5, 1.0);
			return output;
		}

		if (uniforms.uRenderMode == 0) {
			output.color0 = vec4f(emojiColor.rgb, 1.0);
		} else {
			let tinted = mix(emojiColor.rgb, emojiColor.rgb * splatColor * 1.5, uniforms.uTintIntensity);
			output.color0 = vec4f(tinted, 1.0);
		}
	#endif
	return output;
}
`;
