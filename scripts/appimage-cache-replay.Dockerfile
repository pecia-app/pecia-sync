FROM ubuntu:24.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libglib2.0-bin=2.80.0-6ubuntu3.9 libglib2.0-dev-bin=2.80.0-6ubuntu3.9 libgtk-3-0t64=3.24.41-4ubuntu1.3 libgdk-pixbuf2.0-bin=2.42.10+dfsg-3ubuntu3.3
ENV PECIA_CACHE_REPLAY=1
