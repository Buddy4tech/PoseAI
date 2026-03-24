import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

let detector: poseDetection.PoseDetector | null = null;

export async function initPoseDetection() {
  if (detector) return detector;
  
  // Explicitly set backend to WebGL to avoid WebGPU issues with video textures
  await tf.setBackend('webgl');
  await tf.ready();
  
  const model = poseDetection.SupportedModels.MoveNet;
  detector = await poseDetection.createDetector(model, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
  });
  return detector;
}

export function calculatePoseAccuracy(currentPose: poseDetection.Pose, targetPose: poseDetection.Pose | null): number {
  if (!currentPose.keypoints || !targetPose || !targetPose.keypoints) return 0;
  
  let totalDistance = 0;
  let count = 0;
  
  const relevantPoints = ['nose', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee', 'right_knee'];
  
  // Normalize keypoints to be relative to the bounding box or center
  const getCenter = (pose: poseDetection.Pose) => {
    const validKps = pose.keypoints.filter(kp => (kp.score || 0) > 0.3);
    if (validKps.length === 0) return { x: 0, y: 0 };
    const sumX = validKps.reduce((acc, kp) => acc + kp.x, 0);
    const sumY = validKps.reduce((acc, kp) => acc + kp.y, 0);
    return { x: sumX / validKps.length, y: sumY / validKps.length };
  };

  const currentCenter = getCenter(currentPose);
  const targetCenter = getCenter(targetPose);

  currentPose.keypoints.forEach(kp => {
    if (kp.name && relevantPoints.includes(kp.name) && (kp.score || 0) > 0.3) {
      const targetKp = targetPose.keypoints.find(tkp => tkp.name === kp.name);
      if (targetKp && (targetKp.score || 0) > 0.3) {
        // Calculate relative distance
        const dx = (kp.x - currentCenter.x) - (targetKp.x - targetCenter.x);
        const dy = (kp.y - currentCenter.y) - (targetKp.y - targetCenter.y);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Normalize distance (assuming 640x480 or similar)
        const normalizedDist = Math.min(distance / 100, 1);
        totalDistance += (1 - normalizedDist);
        count++;
      }
    }
  });
  
  if (count === 0) return 0;
  const score = Math.round((totalDistance / count) * 100);
  return Math.max(0, Math.min(100, score));
}

export function drawSkeleton(ctx: CanvasRenderingContext2D, pose: poseDetection.Pose, color: string = '#00FF00') {
  const keypoints = pose.keypoints;
  
  // Draw points
  keypoints.forEach(kp => {
    if (kp.score && kp.score > 0.3) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
  });
  
  // Draw lines
  const adjacentPairs = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
  adjacentPairs.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];
    
    if (kp1.score && kp1.score > 0.3 && kp2.score && kp2.score > 0.3) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}
