// iPhone-style "continuous" corners (the iOS superellipse-ish curve, same construction as app icons /
// device screens): three cubic beziers per corner, built in pixels from the measured box. CSS
// border-radius only does circular arcs and `corner-shape` isn't in Safari/Firefox yet.
const CORNER: Array<[number, number]> = [
  [1.08849296, 0], [0.86840694, 0], [0.63149379, 0.07491139],
  [0.37282383, 0.16905956], [0.16905956, 0.37282383], [0.07491139, 0.63149379],
  [0, 0.86840694], [0, 1.08849296], [0, 1.52866483],
];

export function buildContinuousPath(w: number, h: number, r: number): string {
  const ext = 1.52866483 * r;
  const f = (n: number) => n.toFixed(2);
  const corner = (map: (a: number, b: number) => [number, number]) => {
    let out = '';
    for (let i = 0; i < CORNER.length; i += 3) {
      const pts = [0, 1, 2].map((k) => map(CORNER[i + k][0] * r, CORNER[i + k][1] * r));
      out += `C${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(',')}`;
    }
    return out;
  };
  return (
    `M${f(ext)} 0L${f(w - ext)} 0` +
    corner((a, b) => [w - a, b]) +
    `L${f(w)} ${f(h - ext)}` +
    corner((a, b) => [w - b, h - a]) +
    `L${f(ext)} ${f(h)}` +
    corner((a, b) => [a, h - b]) +
    `L0 ${f(ext)}` +
    corner((a, b) => [b, a]) +
    'Z'
  );
}
