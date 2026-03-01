#!/bin/bash
# Serve babylog via Tailscale Serve with path-based routing.
# API path is more specific, so it takes priority over the frontend catch-all.
#
# /babylog/api/* -> localhost:3849/api/*
# /babylog/*     -> localhost:5174/babylog/*

/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg --set-path /babylog/api http://localhost:3849/api
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg --set-path /babylog http://localhost:5174/babylog
