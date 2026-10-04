FROM node:24-alpine
WORKDIR /app
COPY package.json index.html styles.css app.js config.js ./
COPY assets ./assets
COPY innebandyregler ./innebandyregler
COPY server ./server
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/vdk.sqlite
EXPOSE 3000
CMD ["node", "server/index.mjs"]
