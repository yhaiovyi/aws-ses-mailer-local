FROM mhart/alpine-node:16.4.2

WORKDIR /home/node/app
COPY . .
RUN npm install --loglevel=silent

ENV PORT=9323
EXPOSE 9323

CMD [ "npm", "start", "--", "--transport-config", "/home/node/transport-config.json"]