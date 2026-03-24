FROM bottleneck-desktop-base:latest

USER root

# Install Chromium for browser automation
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium-browser chromium-chromedriver && \
    rm -rf /var/lib/apt/lists/*

USER orgo
WORKDIR /home/orgo

RUN python3 -m venv /home/orgo/venv && \
    /home/orgo/venv/bin/pip install --no-cache-dir \
    playwright beautifulsoup4 requests httpx lxml

ENV PATH="/home/orgo/venv/bin:$PATH"
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"

LABEL orgo.template=true orgo.template.name=scraper
