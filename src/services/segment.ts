
import { segmentWriteKey, apiUrl } from '../env';
import Analytics from 'analytics-node';
const analytics = new Analytics(segmentWriteKey, { flushAt: 1})

export function trackSubscriptionLapsed(email:string) {
  analytics.track({
    event: 'Subscription Lapsed',
    userId: email,
    properties: { apiUrl, email }
  })
}

export function trackSubscriptionCancelled(email:string) {
  analytics.track({
    event: 'Subscription Cancelled',
    userId: email,
    properties: { apiUrl, email }
  })
}

export function trackSubscriptionRestored(email:string) {
  analytics.track({
    event: 'Subscription Restored',
    userId: email,
    properties: { apiUrl, email }
  })
}