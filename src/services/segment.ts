
import { segmentWriteKey, apiUrl } from '../env';
import Analytics from 'analytics-node';

const usingSegment = typeof segmentWriteKey === 'string';
function getAnalytics() {
  return usingSegment ? new Analytics(segmentWriteKey, { flushAt: 1}) : null;
}

export function trackSubscriptionLapsed(email:string) {
  const analytics = getAnalytics();
  if (analytics) analytics.track({
    event: 'Subscription Lapsed',
    userId: email,
    properties: { apiUrl, email }
  })
}

export function trackSubscriptionCancelled(email:string) {
  const analytics = getAnalytics();
  if (analytics) analytics.track({
    event: 'Subscription Cancelled',
    userId: email,
    properties: { apiUrl, email }
  })
}

export function trackSubscriptionRestored(email:string) {
  const analytics = getAnalytics();
  if (analytics) analytics.track({
    event: 'Subscription Restored',
    userId: email,
    properties: { apiUrl, email }
  })
}