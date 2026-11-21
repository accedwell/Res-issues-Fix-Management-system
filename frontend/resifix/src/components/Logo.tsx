// The ResiFix logo: four residence towers, each with a lighter side so they look solid.
// The same drawing is in public/favicon.svg (the browser tab icon).
export function Logo() {
  return (
    <svg viewBox="0 0 39 49" aria-hidden="true" focusable="false">
      {/* Short teal-blue block */}
      <polygon points="3,24 9,22 9,46 3,46" fill="#0b6a86" />
      <polygon points="9,22 12,23 12,46 9,46" fill="#2a93ab" />
      {/* Tall teal tower with a sloping roof */}
      <polygon points="12,13 19,3 19,46 12,46" fill="#069684" />
      <polygon points="19,3 21,6 21,46 19,46" fill="#2db3a4" />
      {/* Navy tower */}
      <polygon points="21,14 27,12 27,46 21,46" fill="#0c3a68" />
      <polygon points="27,12 30,14 30,46 27,46" fill="#2d6ea5" />
      {/* Short indigo block */}
      <polygon points="30,22 34,20 34,46 30,46" fill="#1b1749" />
      <polygon points="34,20 36,22 36,46 34,46" fill="#3a3577" />
    </svg>
  )
}
