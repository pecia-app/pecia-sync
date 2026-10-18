FROM alpine:3.21@sha256:ce64758a109eb420d874a118f87920e625e12d3634e03b4a5573fd9f6e5d3507
RUN apk add --no-cache bash alpine-sdk clang cmake ninja meson autoconf automake libtool linux-headers eudev-dev gettext-dev xz file python3 nodejs
ENV PECIA_RUNTIME_REBUILD=1
