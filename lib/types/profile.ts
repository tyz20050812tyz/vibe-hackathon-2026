export type ProfileOverview = {
  profile: {
    id: string;
    displayName: string | null;
    email: string;
    joinedAt: string | null;
  };
  stats: {
    savedCount: number;
    notedCount: number;
    topicCount: number;
    latestSavedAt: string | null;
  };
};

export type ProfileUpdate = {
  displayName: string;
};
