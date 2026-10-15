fn main() {
    // Icons are embedded in the native executable; restart alone is insufficient.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
