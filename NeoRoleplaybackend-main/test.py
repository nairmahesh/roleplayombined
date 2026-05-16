from elevenlabs import ElevenLabs

client = ElevenLabs(api_key="a510075647826d1da5cc042edb62bd35b0c6db01e2febb4a0c3f30d9f1814446")

# You can search for terms like 'female', 'Spanish', or 'American'
voices = client.voices.search(search="chinese")

for voice in voices.voices:
    print(f"{voice.name}: {voice.voice_id}")