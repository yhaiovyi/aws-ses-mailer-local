FROM mhart/alpine-node:16.4.2

# Create app directory
RUN mkdir -p /aws-ses-mailer-local
WORKDIR /aws-ses-mailer-local

# Copy service
COPY ./ /aws-ses-mailer-local
RUN npm install --loglevel=silent

ENV PORT=9323
EXPOSE 9323

CMD [ "npm", "start", "--", "--transport-config", "/home/node/config.json"]