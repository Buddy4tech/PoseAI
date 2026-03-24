export type SceneType = 'Beach' | 'Park' | 'Cafe' | 'Street' | 'Monument' | 'Mountain' | 'Temple' | 'Indoor' | 'Other';

export interface Pose {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  skeletonData?: any; // Normalized keypoints
}

export type FilterType = 'none' | 'cinematic' | 'vintage' | 'bw' | 'vivid' | 'warm';

export interface AppState {
  step: 'welcome' | 'capture-bg' | 'filter-bg' | 'upload-profile' | 'generating' | 'gallery' | 'pose-guide' | 'comparison';
  backgroundImage?: string;
  profileImage?: string;
  sceneType?: SceneType;
  generatedPoses: Pose[];
  selectedPose?: Pose;
  capturedPhoto?: string;
  activeFilter: FilterType;
}
