import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "public/**"],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Many tools legitimately initialize state from external stores
      // (localStorage preferences), reset derived state when the picked file
      // changes, or load lazy engines inside effects. The default "error"
      // level flags all of these; they are intentional here.
      "react-hooks/set-state-in-effect": "warn",
      // The editors paint committed overlays from refs inside effects —
      // intentional imperative canvas syncing the compiler can't model.
      "react-hooks/immutability": "warn",
    },
  },
];
