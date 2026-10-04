import "./styles.css";
import { exampleBooks, toSyncCsv } from "./lib/csv";
function downloadExample() { const blob = new Blob([toSyncCsv(exampleBooks)], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "pecia-sync-example.csv"; link.click(); URL.revokeObjectURL(url); const status = document.querySelector<HTMLElement>("#export-status"); if (status) status.textContent = "Example written locally. Nothing was uploaded."; }
window.addEventListener("DOMContentLoaded", () => document.querySelector("#example-export")?.addEventListener("click", downloadExample));
