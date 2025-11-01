############################
# Docker build environment #
############################

FROM node:22-bookworm-slim AS build

# Upgrade all packages and install dependencies
RUN apt-get update \
    && apt-get upgrade -y
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        python3 \
        build-essential \
        cmake \
        curl \
        ca-certificates \
    && apt clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /build

COPY . .

# 先安装缺失的依赖，再安装项目依赖并构建
RUN npm install date-fns date-fns-tz \
    && npm install \
    && npm run build

############################
# Docker final environment #
############################

FROM node:22-bookworm-slim

# Expose ports for Stratum and Bitcoin RPC
EXPOSE 3333 3334 8332

WORKDIR /public-pool

# Copy built binaries into the final image
COPY --from=build /build .

CMD ["/usr/local/bin/node", "dist/main"]
