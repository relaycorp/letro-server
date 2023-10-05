FROM node:20.3.1 as build
WORKDIR /tmp/letro-server
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build && npm prune --omit=dev && rm -r src

FROM node:20.3.1-slim
LABEL org.opencontainers.image.source="https://github.com/relaycorp/letro-server"
USER node
WORKDIR /opt/letro-server
COPY --chown=node:node --from=build /tmp/letro-server ./
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
CMD ["node", "--unhandled-rejections=strict", "--experimental-vm-modules", "--enable-source-maps", "./build/bin/server.js"]
EXPOSE 8080
