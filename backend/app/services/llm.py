class LLMService:
    async def parse_image(self, image_bytes: bytes, mime_type: str) -> list[dict]:
        raise NotImplementedError("LLM parsing not yet implemented")
