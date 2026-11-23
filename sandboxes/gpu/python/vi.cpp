// Both backends trace the same rays, surface, reflections, and antialiasing samples.
#ifdef __CUDACC__
#define FN __device__ __forceinline__
#else
#include <cmath>
#define FN inline
#endif

struct V {
  float x, y, z;
};
FN V v(float x, float y, float z) {
  return {x, y, z};
}
FN V operator+(V a, V b) {
  return v(a.x + b.x, a.y + b.y, a.z + b.z);
}
FN V operator-(V a, V b) {
  return v(a.x - b.x, a.y - b.y, a.z - b.z);
}
FN V operator*(V a, float b) {
  return v(a.x * b, a.y * b, a.z * b);
}
FN V mult(V a, V b) {
  return v(a.x * b.x, a.y * b.y, a.z * b.z);
}
FN float dot(V a, V b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
FN V norm(V a) {
  return a * (1.0f / sqrtf(dot(a, a)));
}
FN V cross(V a, V b) {
  return v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}
FN float sat(float x) {
  return fminf(fmaxf(x, 0.f), 1.f);
}
FN V mix(V a, V b, float t) {
  return a * (1.f - t) + b * t;
}
FN V reflect(V a, V n) {
  return a - n * (2.f * dot(a, n));
}

struct Scene {
  const float *field;
};
FN float lerp(float a, float b, float t) {
  return a + (b - a) * t;
}
FN float outline(Scene s, float x, float y) {
  const int w = 1024, h = 768;
  float u = sat((x + 1.65f) / 3.3f) * (w - 1), t = sat((y + 1.18f) / 2.36f) * (h - 1);
  int i = (int)u, j = (int)t;
  if (i >= w - 1)
    i = w - 2;
  if (j >= h - 1)
    j = h - 2;
  const float *p = s.field + j * w + i;
  float d = lerp(lerp(p[0], p[1], u - i), lerp(p[w], p[w + 1], u - i), t - j);
  return d + fmaxf(fmaxf(fabsf(x) - 1.65f, fabsf(y) - 1.18f), 0.f);
}
FN float surface(Scene s, V p) {
  float dist = outline(s, p.x, p.y), a = dist + .091f;
  float crown = .22f * fminf(.255f, fmaxf(-dist - .073f, 0.f));
  float b = fabsf(p.z) - .162f - (p.z > 0 ? crown : 0.f);
  return fminf(fmaxf(a, b), 0.f) + sqrtf(fmaxf(a, 0.f) * fmaxf(a, 0.f) + fmaxf(b, 0.f) * fmaxf(b, 0.f)) -
         .091f;
}
FN float hit(Scene s, V origin, V ray) {
  float lo = 0.f, hi = 32.f;
  const float bounds[3] = {1.50f, 1.01f, .315f};
  const float o[3] = {origin.x, origin.y, origin.z}, d[3] = {ray.x, ray.y, ray.z};
  for (int k = 0; k < 3; k++) {
    if (fabsf(d[k]) < 1e-7f) {
      if (fabsf(o[k]) > bounds[k])
        return -1.f;
      continue;
    }
    float a = (-bounds[k] - o[k]) / d[k], b = (bounds[k] - o[k]) / d[k];
    lo = fmaxf(lo, fminf(a, b));
    hi = fminf(hi, fmaxf(a, b));
  }
  if (hi <= lo)
    return -1.f;
  float t = lo;
  for (int i = 0; i < 62 && t <= hi + .001f; i++) {
    float gap = surface(s, origin + ray * t);
    if (gap < .00045f)
      return t;
    t += fmaxf(.00025f, gap * .92f);
  }
  return -1.f;
}
FN V normalAt(Scene s, V p) {
  const float e = .0011f;
  return norm(v(surface(s, p + v(e, 0, 0)) - surface(s, p - v(e, 0, 0)),
                surface(s, p + v(0, e, 0)) - surface(s, p - v(0, e, 0)),
                surface(s, p + v(0, 0, e)) - surface(s, p - v(0, 0, e))));
}
// Softboxes are procedural radiance sources. They only appear in reflected or transmitted rays.
FN V studio(V r, float phase) {
  float sweep = .16f * sinf(phase);
  float key =
      expf(-20.f * (r.x + .48f + sweep) * (r.x + .48f + sweep) - 1.5f * (r.y - .68f) * (r.y - .68f));
  float ribbon = r.y - .30f - .52f * r.x + sweep, strip = expf(-235.f * ribbon * ribbon);
  float rim = r.x - .63f + .28f * r.y, cyan = expf(-76.f * rim * rim);
  float warm = expf(-8.f * (r.y + .42f) * (r.y + .42f) - 2.f * (r.x + .6f) * (r.x + .6f));
  return v(.018f, .021f, .047f) + v(1.1f, .81f, .74f) * key + v(2.8f, 2.75f, 3.1f) * strip +
         v(.40f, .78f, 1.75f) * cyan + v(1.30f, .22f, .12f) * warm;
}
FN V refractRay(V incident, V outward, float eta) {
  float c = -dot(incident, outward), k = 1.f - eta * eta * (1.f - c * c);
  if (k < 0.f)
    return v(0, 0, 0);
  return incident * eta + outward * (eta * c - sqrtf(k));
}
// Trace the interior until the ray hits the core or crosses the back or side of the crystal.
FN float glassExit(Scene s, V start, V direction) {
  float t = .004f;
  for (int i = 0; i < 56; i++) {
    float inside = -surface(s, start + direction * t);
    if (inside < .00065f)
      return t;
    t += fmaxf(inside * .91f, .0007f);
  }
  return t;
}
FN V core(Scene s, V p, V ray, float phase) {
  // Plane cuts along the distance contours give the inner metal broad reflective facets.
  float e = .0025f, d = -outline(s, p.x, p.y);
  float nx = (outline(s, p.x + e, p.y) - outline(s, p.x - e, p.y)) / (2.f * e);
  float ny = (outline(s, p.x, p.y + e) - outline(s, p.x, p.y - e)) / (2.f * e);
  float band = d < .16f ? .79f : (d < .235f ? .43f : .15f);
  float facet = floorf((p.y * .85f + p.x * .52f + 1.5f) * 2.1f);
  V n = norm(v(nx * band + .12f * sinf(facet * 1.9f), ny * band + .16f * cosf(facet * 2.2f), 1.f));
  V reflected = studio(reflect(ray, n), phase);
  float height = sat((.94f - p.y) / 1.89f);
  V titanium = height < .5f ? mix(v(.29f, .32f, .86f), v(.72f, .25f, .50f), height * 2.f)
                            : mix(v(.72f, .25f, .50f), v(1.0f, .54f, .18f), height * 2.f - 1.f);
  float polish = .94f + .06f * cosf(480.f * (d + .008f * sinf(p.y * 12.f)));
  return mult(titanium, v(.095f, .105f, .15f) + reflected * 1.42f) * polish;
}
FN float channel(V color, int i) {
  return i == 0 ? color.x : (i == 1 ? color.y : color.z);
}
FN float transmission(Scene s, V p, V ray, V n, float phase, float index, int lane) {
  V direction = refractRay(ray, n, 1.f / index);
  float travel = glassExit(s, p, direction);
  float backing = (-.075f - p.z) / (fabsf(direction.z) > .0001f ? direction.z : .0001f);
  if (backing > 0 && backing < travel) {
    V q = p + direction * backing;
    float inset = -outline(s, q.x, q.y);
    if (inset > .085f)
      return channel(core(s, q, direction, phase), lane) * expf(-.24f * backing);
  }
  V exitPoint = p + direction * travel, edge = normalAt(s, exitPoint);
  V out = refractRay(direction, edge * -1.f, index);
  if (dot(out, out) < .1f) {
    direction = reflect(direction, edge);
    float more = glassExit(s, exitPoint, direction);
    travel += more;
    out = refractRay(direction, normalAt(s, exitPoint + direction * more) * -1.f, index);
    if (dot(out, out) < .1f)
      out = direction;
  }
  return channel(studio(out, phase), lane) *
         expf(-travel * (lane == 0 ? .55f : (lane == 1 ? .39f : .18f)));
}
FN V lettering(Scene s, V p, V ray, float phase) {
  V n = normalAt(s, p);
  float cosine = sat(-dot(ray, n));
  float fresnel = .042f + .958f * powf(1.f - cosine, 5.f);
  V transmitted =
      v(transmission(s, p, ray, n, phase, 1.48f, 0), transmission(s, p, ray, n, phase, 1.51f, 1),
        transmission(s, p, ray, n, phase, 1.55f, 2));
  return mix(transmitted, studio(reflect(ray, n), phase), fresnel);
}
FN V trace(Scene s, V eye, V ray, float sx, float sy, float phase, float jitter) {
  float t = hit(s, eye, ray);
  if (t >= 0)
    return lettering(s, eye + ray * t, ray, phase);
  float glow = expf(-2.6f * (sx * sx + (sy + .12f) * (sy + .12f)));
  V background = v(.0024f, .0031f, .0070f) + v(.009f, .008f, .018f) * glow;
  if (ray.y >= -.001f)
    return background;
  float at = (-.963f - eye.y) / ray.y;
  V floor = eye + ray * at;
  float fade = expf(-2.0f * fabsf(floor.z)) * .33f;
  if (fade < .002f)
    return background;
  V bounce = norm(v(ray.x + .016f * jitter, -ray.y, ray.z));
  float second = hit(s, floor + v(0, .004f, 0), bounce);
  if (second > 0)
    return background + lettering(s, floor + v(0, .004f, 0) + bounce * second, bounce, phase) * fade;
  return background;
}
FN unsigned char display(float x) {
  x = fmaxf(x, 0.f);
  return (unsigned char)(255.f * powf(sat(x * (2.51f * x + .03f) / (x * (2.43f * x + .59f) + .14f)),
                                      1.f / 2.2f) +
                         .5f);
}
FN void pixel(Scene s, unsigned char *out, int width, int height, int frame, int frames, int samples,
              int x, int y) {
  float phase = 6.2831853f * frame / frames;
  V eye = v(.86f * cosf(phase + .45f), .32f + .16f * sinf(phase), 4.1f + .13f * cosf(phase));
  V f = norm(v(0, -.13f, 0) - eye), right = norm(cross(f, v(0, 1, 0))), up = cross(right, f);
  V acc = v(0, 0, 0);
  for (int k = 0; k < samples; k++) {
    float dx = (k + .5f) / samples, dy = k * .618033989f + .37f;
    dy -= floorf(dy);
    float sx = ((x + dx) / width * 2.f - 1.f) * (float)width / height;
    float sy = 1.f - (y + dy) / height * 2.f;
    V ray = norm(f + right * (sx * .415f) + up * (sy * .415f));
    acc = acc + trace(s, eye, ray, sx, sy, phase, dy - .5f);
  }
  acc = acc * (1.f / samples);
  int idx = 3 * (y * width + x);
  out[idx] = display(acc.x);
  out[idx + 1] = display(acc.y);
  out[idx + 2] = display(acc.z);
}
#ifdef __CUDACC__
extern "C" __global__ void render(const float *field, unsigned char *out, int w, int h, int frame,
                                  int frames, int samples) {
  int i = blockIdx.x * blockDim.x + threadIdx.x;
  if (i < w * h)
    pixel({field}, out, w, h, frame, frames, samples, i % w, i / w);
}
#else
extern "C" void rows(const float *field, unsigned char *out, int w, int h, int frame, int frames,
                     int samples, int first, int last) {
  for (int y = first; y < last; y++)
    for (int x = 0; x < w; x++)
      pixel({field}, out, w, h, frame, frames, samples, x, y);
}
#endif
