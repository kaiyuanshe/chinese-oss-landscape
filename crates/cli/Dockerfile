# Prepare the same Node and Yarn versions used by CI.
FROM node:26.12.1-alpine3.24 AS node
RUN npm install --global --prefix /usr/local yarn@1.22.22

# Build CLI tool
FROM rust:1.99.1-alpine3.24 AS builder
RUN apk --no-cache add musl-dev perl make libconfig-dev openssl-dev libatomic libstdc++
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/yarn /usr/local/lib/node_modules/yarn
RUN ln -s ../lib/node_modules/yarn/bin/yarn.js /usr/local/bin/yarn \
    && ln -s ../lib/node_modules/yarn/bin/yarn.js /usr/local/bin/yarnpkg \
    && test "$(node --version)" = "v26.12.1" \
    && test "$(yarn --version)" = "1.22.22"
WORKDIR /landscape2
COPY crates crates
COPY ui ui
COPY site/brand.json site/brand.json
COPY scripts/site-brand.mjs scripts/site-brand.mjs
COPY Cargo.* ./
WORKDIR /landscape2/crates/cli
RUN cargo build --release --locked

# Final stage
FROM alpine:3.24.3
RUN addgroup -S landscape2 && adduser -S landscape2 -G landscape2
RUN apk --no-cache add bash chromium font-noto
USER landscape2
WORKDIR /home/landscape2
COPY --from=builder /landscape2/target/release/landscape2 /usr/local/bin
COPY scripts/landscape2-validate.sh /
