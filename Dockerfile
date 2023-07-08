FROM node:20.4.0 as build
WORKDIR /tmp/letro-server
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build && npm prune --omit=dev && rm -r src

FROM node:20.4.0-slim
LABEL org.opencontainers.image.source="https://github.com/relaycorp/letro-server"
USER node
WORKDIR /opt/letro-server
COPY --chown=node:node --from=build /tmp/letro-server ./
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NODE_OPTIONS="--unhandled-rejections=strict --experimental-vm-modules --enable-source-maps"
ENTRYPOINT ["npm", "exec"]
EXPOSE 8080
