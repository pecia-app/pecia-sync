# Experimental toolchain, not the proven historical PDF.js build environment.
FROM rust:1.97.1@sha256:b1b3c9c0d921d7fa0a6d1f9ec7e4eab87f8c8ec97644c3d791450f131dec813f
RUN rustup target add wasm32-unknown-unknown
RUN cargo install --locked wasm-bindgen-cli --version 0.2.126
RUN curl -fL https://github.com/WebAssembly/binaryen/releases/download/version_117/binaryen-version_117-x86_64-linux.tar.gz -o /tmp/binaryen.tar.gz \
    && echo '3dc677006555b355ea2da5e82602065a161d5e83eaefd3f759afa00b96e83212  /tmp/binaryen.tar.gz' | sha256sum -c - \
    && tar -xzf /tmp/binaryen.tar.gz -C /opt
WORKDIR /work
