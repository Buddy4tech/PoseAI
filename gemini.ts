import { GoogleGenAI, Type } from "@google/genai";

const MODEL_NAME = "gemini-3-flash-preview";
const IMAGE_MODEL = "gemini-2.5-flash-image";

export async function detectScene(base64Image: string): Promise<{ scene: string; poses: string[] }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        parts: [
          { text: "Analyze this background image and identify the scene type. Then, suggest 20 unique and trendy photo poses and camera compositions. Your suggestions MUST be inspired by both global Instagram influencers and professional filmmaking camera angle theories. Include famous techniques like: Dutch Angle (tilted for tension), Low Angle (Hero Shot), High Angle (vulnerability), Wes Anderson-style Symmetry, Leading Lines, and Rule of Thirds. Also include modern social media trends like the 'SnorriCam' look, Flat Lay, and Cinematic Candid. For each pose, provide a descriptive name that reflects the filmmaking theory or influencer style. Return as JSON." },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1]
            }
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scene: { type: Type.STRING },
          poses: { 
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of 20 trendy influencer-style poses."
          }
        },
        required: ["scene", "poses"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function generatePoseImage(backgroundBase64: string, profileBase64: string, poseDescription: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: backgroundBase64.split(',')[1]
          }
        },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: profileBase64.split(',')[1]
          }
        },
        {
          text: `Place the person from the second image into the first background image. The person should be performing the following pose or camera composition: ${poseDescription}. 
          If the pose name mentions a filmmaking theory (like Dutch Angle, Low Angle, or Wes Anderson Symmetry), strictly apply that camera angle and composition style to the final image. 
          Ensure the lighting, shadows, and scale match the background perfectly. The face should clearly be the person from the second image, and the overall look should be cinematic and professional.`
        }
      ]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("Failed to generate image");
}
