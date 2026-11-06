
const publishAnimalRecommendationMetrics = ({
  appVersion,
  appTrack,
  recommendedCount
}) => {
  if (process.env.CLOUDWATCH_EMF_ENABLED !== 'true') {
    return;
  }

  const metricEvent = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: 'PetAdoption/Canary',
          Dimensions: [
            ['AppVersion', 'AppTrack']
          ],
          Metrics: [
            {
              Name: 'AnimalRecommendationRequests',
              Unit: 'Count'
            },
            {
              Name: 'AnimalsRecommended',
              Unit: 'Count'
            }
          ]
        }
      ]
    },
    AppVersion: appVersion || 'unknown',
    AppTrack: appTrack || 'unknown',
    AnimalRecommendationRequests: 1,
    AnimalsRecommended: recommendedCount
  };

  process.stdout.write(`${JSON.stringify(metricEvent)}\n`);
};

module.exports = {
  publishAnimalRecommendationMetrics
};
