# Video Studio Co. Implementation Plan

## Overview
Add a third company building "Video Studio Co." west of the main building with 3 offices:
- Video Learning & Research (analyzes YouTube videos, extracts learnings)
- Script & Storyboard (writes video scripts, scene-by-scene plans)
- Video Editing (post-production, motion graphics, sound design)

## Architecture Changes

### 1. Frontend (index.html)
- Add VIDEO array with 3 offices (similar to SOCIAL)
- Place building west of main building (x = -58, z = 50)
- Add VIDEO_CX coordinates: [-68, -58, -48]
- Build 3 video offices (indices 19, 20, 21)
- Add navigation nodes and courier robot support
- Update camera views
- Add "Video Studio Co." button
- Update agent spawning logic

### 2. Backend (api-bridge.js)
- Add video report handler similar to socialReport
- Add YouTube transcript fetching (ytInitialPlayerResponse parsing)
- Add videoReport function that calls video-researcher agent
- Wire up video routing in WebSocket handlers

### 3. Agent Profiles (already created)
- ✓ video-researcher.md
- ✓ script-writer.md  
- ✓ video-editor.md

### 4. Configuration
- ✓ Update agent-map.json with "video" section
- Update NAMES array (add 15 more names for video staff)
- Update ROLES array (add video roles)
- Update FAVOUR array (add work preferences)
- Update HEAD_LINE array (add 3 lines)

### 5. Testing
- Update agent-brain.test.js to handle Video Studio Co.
- Add integration test for video workflow

## Building Layout
- Position: x = -58 (west), z = 50 (south)
- Same dimensions as Social Media Co. (31m x 22m)
- Street from west gate to building entrance
- 3 offices side-by-side
- Purple/teal/orange color scheme

## Courier Routes
- Add robots to Video Studio Co.
- Connect west gate → Video Studio plaza
- Cross-company handoffs at plaza

## User Experience
- Ask: "ask Video Learning to watch https://youtube.com/... and report to Product"
- Video Learning analyzes transcript, retention, narrative
- Reports back with creative insights and applications
