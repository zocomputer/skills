# ffmpeg Recipes for Video Producer

## Ken Burns Effects

### Zoom In (center)
```bash
ffmpeg -y -loop 1 -i image.png -t 5 \
  -vf "scale=2160:3840,zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1080x1920:fps=30" \
  -c:v libx264 -pix_fmt yuv420p output.mp4
```

### Zoom Out
```bash
# Start zoomed in at 1.3x, slowly zoom out to 1.0x
zoompan=z='if(eq(on,1),1.3,max(zoom-0.0015,1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'
```

### Pan Left
```bash
zoompan=z='1.15':x='iw*0.15-on*(iw*0.15/FRAMES)':y='ih/2-(ih/zoom/2)'
```

### Pan Right
```bash
zoompan=z='1.15':x='on*(iw*0.15/FRAMES)':y='ih/2-(ih/zoom/2)'
```

## Scene Transitions

### Fade (xfade)
```bash
ffmpeg -y -i clip1.mp4 -i clip2.mp4 \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=3.5[vout]" \
  -map "[vout]" -c:v libx264 output.mp4
```

### Available xfade transitions
fade, fadeblack, fadewhite, dissolve, pixelize, wipeleft, wiperight, wipeup, wipedown, slideleft, slideright, slideup, slidedown, circlecrop, rectcrop, distance, smoothleft, smoothright, smoothup, smoothdown

## Audio Mixing

### Voiceover + background music (ducked)
```bash
ffmpeg -y -i voiceover.mp3 -i music.mp3 \
  -filter_complex "[0:a]aresample=44100[vo];[1:a]aresample=44100,volume=0.15,atrim=0:15,afade=t=out:st=13:d=2[bg];[vo][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]" \
  -map "[aout]" -c:a aac -b:a 192k mixed.aac
```

### Fade out music at end
```bash
afade=t=out:st=DURATION-2:d=2
```

## Text Overlays

### Centered text with outline (Montserrat Bold)
```bash
drawtext=fontfile=/path/to/Montserrat-Bold.ttf:text='Your Text':fontsize=56:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.82
```

### Timed text (show between 0.5s and 4.5s)
```bash
drawtext=...:enable='between(t,0.5,4.5)'
```

### Multi-line text
```bash
drawtext=...:text='Line 1':y=h*0.78,drawtext=...:text='Line 2':y=h*0.85
```

## Caption Burn-in

### ASS subtitles
```bash
ffmpeg -y -i video.mp4 -vf "ass=captions.ass" -c:v libx264 -c:a copy output.mp4
```

### SRT subtitles
```bash
ffmpeg -y -i video.mp4 -vf "subtitles=captions.srt:force_style='FontName=Montserrat,FontSize=24,PrimaryColour=&H00FFFFFF'" output.mp4
```

## Platform Optimization

### TikTok/Reels (9:16, 1080x1920)
```bash
ffmpeg -y -i input.mp4 \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k -movflags +faststart output.mp4
```

### YouTube (16:9, 1920x1080)
```bash
ffmpeg -y -i input.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k -movflags +faststart output.mp4
```

## Thumbnail Generation

### Extract frame at 2 seconds
```bash
ffmpeg -y -i video.mp4 -ss 2 -frames:v 1 thumbnail.png
```

### Extract frame with text overlay
```bash
ffmpeg -y -i video.mp4 -ss 2 -frames:v 1 \
  -vf "drawtext=fontfile=Montserrat-Bold.ttf:text='Watch Now':fontsize=72:fontcolor=white:borderw=4:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2" \
  thumbnail.png
```

## Concat Methods

### Simple concat (no transitions)
```bash
# Create list file
printf "file 'clip1.mp4'\nfile 'clip2.mp4'\nfile 'clip3.mp4'" > list.txt
ffmpeg -y -f concat -safe 0 -i list.txt -c copy output.mp4
```

### Re-encoding concat (different codecs)
```bash
ffmpeg -y -f concat -safe 0 -i list.txt -c:v libx264 -pix_fmt yuv420p output.mp4
```
