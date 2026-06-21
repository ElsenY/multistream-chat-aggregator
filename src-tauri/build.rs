fn main() {
    tonic_build::configure()
        .build_server(false)
        .compile(&["src/stream_list.proto"], &["src"])
        .unwrap();
    tauri_build::build()
}
