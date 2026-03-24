FROM bottleneck-desktop-base:latest

USER root

RUN npm install -g pnpm@latest typescript tsx vitest && \
    npm cache clean --force

USER orgo
WORKDIR /home/orgo

RUN mkdir -p /home/orgo/project

LABEL orgo.template=true orgo.template.name=nodejs-dev
