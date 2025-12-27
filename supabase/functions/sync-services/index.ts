import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMMService {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string;
  min: string;
  max: string;
  // Some providers include service-specific instructions/description text
  desc?: string;
  description?: string;
  instructions?: string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
}

interface Provider {
  name: string;
  url: string;
  apiKey: string;
}

interface SyncResult {
  success: boolean;
  count: number;
  deleted: number;
  providerResults: { [key: string]: number };
  warnings: string[];
  errors: string[];
}

// Send email notification for sync issues
async function sendSyncNotification(subject: string, content: string, isError: boolean = false) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const adminEmail = 'admin@quickfollowers.online';
  
  if (!resendApiKey) {
    console.warn('Email notifications not configured - missing RESEND_API_KEY');
    return;
  }
  
  try {
    const resend = new Resend(resendApiKey);
    const timestamp = new Date().toISOString();
    
    await resend.emails.send({
      from: 'QuickFollowers Alerts <no-reply@quickfollowers.online>',
      to: [adminEmail],
      subject: `[QuickFollowers] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${isError ? '#ef4444' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">${isError ? '⚠️ Sync Error' : '📊 Sync Alert'}</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="color: #374151; line-height: 1.6;">${content}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">Timestamp: ${timestamp}</p>
            <p style="color: #6b7280; font-size: 12px;">This is an automated notification from QuickFollowers service sync.</p>
          </div>
        </div>
      `,
    });
    
    console.log(`Email notification sent to ${adminEmail}: ${subject}`);
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

// Generate meaningful and instructional descriptions based on service name and category
function generateDescription(name: string, category: string, min: string, max: string): string {
  const nameLower = name.toLowerCase();
  const categoryLower = category.toLowerCase();
  
  // WhatsApp Contact Save services
  if ((nameLower.includes('whatsapp') || categoryLower.includes('whatsapp')) && 
      (nameLower.includes('contact save') || nameLower.includes('profile save'))) {
    return `📱 WhatsApp Contact Save Service

✅ Get real users to save your contact
✅ Nigerian profiles for local targeting
✅ Increase your WhatsApp visibility

📝 Format:
Enter your phone number with country code.
Example: +2348012345678

⚠️ Number must be active and have WhatsApp.`;
  }
  
  // WhatsApp Channel/Group Members
  if ((nameLower.includes('whatsapp') || categoryLower.includes('whatsapp')) && 
      (nameLower.includes('member') || nameLower.includes('community'))) {
    return `👥 WhatsApp Members Service

✅ Real WhatsApp members
✅ High-quality profiles
✅ Organic growth

📝 Format:
Enter your WhatsApp channel/group/community invite link.
Example: https://whatsapp.com/channel/xxx or https://chat.whatsapp.com/xxx

⚠️ Group/Channel must be public and joinable.`;
  }
  
  // WhatsApp Reactions
  if ((nameLower.includes('whatsapp') || categoryLower.includes('whatsapp')) && 
      (nameLower.includes('reaction') || nameLower.includes('emoji') || nameLower.includes('like'))) {
    return `❤️ WhatsApp Reactions Service

✅ Boost your post engagement
✅ Real reactions from active users
✅ Fast delivery

📝 Format:
Enter your WhatsApp channel post link.
Example: https://whatsapp.com/channel/xxx/123

⚠️ Post must be public and visible.`;
  }
  
  // Check for Traffic/Keyword services - these need detailed instructions
  if ((nameLower.includes('traffic') || categoryLower.includes('traffic')) && 
      (nameLower.includes('keyword') || nameLower.includes('organic') || nameLower.includes('google') || nameLower.includes('search'))) {
    return `💡 Use a bit.ly link to track traffic
💡 Keyword can be added in any language

✅ Organic Keyword Traffic from Search Engines
✅ Add Your Own Custom Keyword (See below how to add it)
✅ 100% Real & Unique Visitors
✅ Google Analytics Supported

⏱ Session Length: 40-60 Seconds per visit
📉 Bounce Rates: Low
⚡ Speed: 10,000 unique visitors per day
⏳ Start Time: 0-12h (we check all links for compliance)

🖥 Desktop Traffic Over 90%
📱 Mobile Traffic Under 10%

⚠️ No Adult, Drug or offensive websites allowed

📝 URL and KEYWORD Format:
Add your URL and keyword in to the link field with a separator. For example:
https://www.domain.com:keyword
or
http://bit.ly/xyz:keyword longtail

1 (ONE) keyword per order. To use multiple keywords create another order for the same URL using a different keyword.`;
  }
  
  // Regular traffic services without keywords
  if (nameLower.includes('traffic') || categoryLower.includes('traffic')) {
    return `✅ Real Website Traffic Visitors
✅ 100% Unique Visitors
✅ Google Analytics Supported

⏱ Session Length: 30-60 Seconds per visit
📉 Bounce Rates: Low
⚡ Speed: Up to 10,000 visitors per day
⏳ Start Time: 0-12 hours

🖥 Desktop Traffic Over 90%
📱 Mobile Traffic Under 10%

⚠️ No Adult, Drug or offensive websites allowed

📝 Enter your website URL in the link field.`;
  }
  
  // Custom comments services
  if (nameLower.includes('custom comment') || (nameLower.includes('comment') && nameLower.includes('custom'))) {
    return `📝 Custom Comments Service

✅ Write your own custom comments
✅ Real-looking engagement
✅ Natural delivery speed

📝 Format:
Enter your comments separated by new lines. Each line = one comment.

Example:
Great post! Love this content 🔥
This is amazing work!
Keep it up! 👏

⚠️ No offensive, spam or inappropriate comments allowed.`;
  }
  
  // Telegram services - expanded with specific service types
  if (nameLower.includes('telegram') || categoryLower.includes('telegram')) {
    // Telegram Dedicated Proxy/VPN for Sponsor Channel - SPECIFIC
    if ((nameLower.includes('proxy') || nameLower.includes('vpn')) && 
        (nameLower.includes('sponsor') || nameLower.includes('dedicated'))) {
      return `⚡️ Telegram Dedicated Proxy or VPN For Sponsor Channel

- Type: Telegram MTProto Proxy
- The Proxy sponsors your channel
- Locations: USA, Netherlands, Switzerland, Poland, Singapore
- Platform: Telegram Desktop and Mobile
- Delivery: 6-12 hours

HOW to Buy Proxy:
- Format: enter your EMAIL + Channel Link + Location (optional)
- Example: yourmail@mail.com + https://t.me/telegram + USA

HOW to Renew Proxy:
- Format: enter your EMAIL + Channel Link + Proxy IP
- Example: yourmail@mail.com + https://t.me/telegram + 192.168.0.1

Note 1: Channel will be shown as sponsored (Optional).
Note 2: Select a location between USA, Netherlands, Switzerland, Poland, and Singapore (Optional).

Attention 1: The proxy (connection link + guide) will be emailed to you so please enter your email correctly!
Attention 2: Remember to check your spam or junk box if you don't find the proxy in your inbox.
Attention 3: In order to renew the proxy, buy again at least 5 days before the end`;

    }
    
    // Telegram Boost/Premium Boost services - SPECIFIC
    if (nameLower.includes('boost') || nameLower.includes('booster') || nameLower.includes('premium boost')) {
      const is1Month = nameLower.includes('1 month') || nameLower.includes('1month') || nameLower.includes('30 day');
      const is3Month = nameLower.includes('3 month') || nameLower.includes('3month') || nameLower.includes('90 day');
      const duration = is3Month ? '3 Months' : is1Month ? '1 Month' : '1 Month';
      
      return `🚀 Telegram Channel Boost Service (${duration})

⚠️ IMPORTANT - READ BEFORE ORDERING:

This service adds Premium Boosts to your Telegram channel to unlock special features and increase visibility.

📝 HOW TO ORDER:
1. Enter your PUBLIC channel username or link
2. Quantity = Number of boosts you want
3. Wait for delivery (starts within 0-1 hour)

📝 Format:
https://t.me/yourchannel or @yourchannel

✅ Premium Telegram Boosts
✅ Unlocks channel features (stories, custom emoji, etc.)
✅ ${duration} boost duration
✅ Increases channel visibility

⚠️ REQUIREMENTS:
- Channel MUST be PUBLIC
- Do NOT change to private during order
- Do NOT change channel username during order

💡 Benefits of Boosting:
- Custom channel backgrounds
- Channel stories
- Custom emoji packs
- Voice-to-text for voice messages
- Increased upload limits`;
    }
    
    // Telegram Channel/Group Members
    if (nameLower.includes('member') || nameLower.includes('subscriber')) {
      const isRealActive = nameLower.includes('real') || nameLower.includes('active') || nameLower.includes('hq');
      const isFake = nameLower.includes('fake') || nameLower.includes('bot');
      
      if (isFake) {
        return `📱 Telegram Members Service (Bot/Inactive)

⚠️ These are BOT/INACTIVE members for number purposes only.

📝 Format:
Enter your Telegram group/channel link.
Example: https://t.me/yourchannel or @yourchannel

✅ Fast delivery
✅ Increases member count
⚠️ NOT for engagement - number boosting only
⚠️ Channel/Group must be PUBLIC`;
      }
      
      return `📱 Telegram Members Service${isRealActive ? ' (Real & Active)' : ''}

✅ ${isRealActive ? 'Real active Telegram members' : 'Telegram members'}
✅ High retention rate
✅ No admin access required

📝 Format:
Enter your Telegram group/channel username or link.
Example: https://t.me/yourchannel or @yourchannel

⚠️ Channel/Group must be PUBLIC
⚠️ Private groups are NOT supported
⚠️ Do not change to private during delivery`;
    }
    
    // Telegram Post Views
    if (nameLower.includes('view') || nameLower.includes('post view')) {
      const isAuto = nameLower.includes('auto') || nameLower.includes('subscription');
      
      if (isAuto) {
        return `👁 Telegram Auto/Subscription Views

✅ Automatic views on new posts
✅ Set once and forget
✅ Works on all new posts

📝 Format:
Enter your Telegram channel username.
Example: @yourchannel or https://t.me/yourchannel

⚠️ Channel must be PUBLIC`;
      }
      
      return `👁 Telegram Post Views Service

✅ Real Telegram Views
✅ Fast delivery
✅ Works on all public posts

📝 Format:
Enter your Telegram post link (with post number).
Example: https://t.me/yourchannel/123

⚠️ Post must be from a PUBLIC channel`;
    }
    
    // Telegram Reactions
    if (nameLower.includes('reaction') || nameLower.includes('emoji')) {
      const emojiMatch = nameLower.match(/[👍❤️🔥😂😢😡💯🎉🤔👎]/);
      const emoji = emojiMatch ? emojiMatch[0] : '❤️';
      
      return `${emoji} Telegram Reactions Service

✅ Get reactions on your posts
✅ Fast delivery
✅ Increases engagement

📝 Format:
Enter your Telegram post link.
Example: https://t.me/yourchannel/123

⚠️ Post must be from a PUBLIC channel
⚠️ Reactions must be enabled on your channel`;
    }
    
    // Telegram Shares/Forwards
    if (nameLower.includes('share') || nameLower.includes('forward')) {
      return `🔄 Telegram Shares/Forwards Service

✅ Increase post visibility
✅ Real shares to other chats
✅ Fast processing

📝 Format:
Enter your Telegram post link.
Example: https://t.me/yourchannel/123

⚠️ Post must be PUBLIC and shareable
⚠️ Forwarding must be enabled`;
    }
    
    // Telegram Poll Votes
    if (nameLower.includes('vote') || nameLower.includes('poll')) {
      return `🗳 Telegram Poll Votes Service

✅ Get votes on your polls
✅ Choose specific option
✅ Fast delivery

📝 Format:
Enter post link with poll and specify the option number.
Format: https://t.me/yourchannel/123 | Option Number

Example: https://t.me/mychannel/456 | 1
(This votes for option 1)

⚠️ Poll must be ACTIVE and PUBLIC
⚠️ Make sure to specify correct option number`;
    }
    
    // Telegram Comments
    if (nameLower.includes('comment')) {
      if (nameLower.includes('custom')) {
        return `💬 Telegram Custom Comments Service

✅ Write your own comments
✅ Appears on your post
✅ Natural delivery

📝 Format:
Enter your post link, then add comments on separate lines.
Format:
https://t.me/yourchannel/123
Comment 1 here
Comment 2 here
Comment 3 here

⚠️ Comments must be enabled on your channel
⚠️ Post must be PUBLIC`;
      }
      
      return `💬 Telegram Comments Service

✅ Get comments on your posts
✅ Random relevant comments
✅ Increases engagement

📝 Format:
Enter your Telegram post link.
Example: https://t.me/yourchannel/123

⚠️ Comments must be enabled on your channel
⚠️ Post must be PUBLIC`;
    }
    
    // Default Telegram
    return `📱 Telegram Service

✅ Quality Telegram engagement
✅ Fast delivery
✅ No password required

📝 Format:
Enter your Telegram channel/group/post link.
Example: https://t.me/yourchannel

⚠️ Must be PUBLIC and accessible`;
  }
  
  // Discord services - expanded with specific types
  if (nameLower.includes('discord') || categoryLower.includes('discord')) {
    // Discord Server Boosts - SPECIFIC
    if (nameLower.includes('boost') || nameLower.includes('nitro boost')) {
      const is1Month = nameLower.includes('1 month') || nameLower.includes('1month') || nameLower.includes('30 day');
      const is3Month = nameLower.includes('3 month') || nameLower.includes('3month') || nameLower.includes('90 day');
      const duration = is3Month ? '3 Months' : is1Month ? '1 Month' : '1 Month';
      
      return `🚀 Discord Server Boost Service (${duration})

⚠️ IMPORTANT - READ BEFORE ORDERING:

This service adds Nitro Boosts to your Discord server to unlock perks and features.

📝 HOW TO ORDER:
1. Create a PERMANENT invite link (never expires)
2. Make sure link has unlimited uses
3. Enter the invite link below

📝 Format:
https://discord.gg/yourcode

✅ Real Nitro Boosts
✅ Unlock server perks (better audio, emojis, etc.)
✅ ${duration} boost duration
✅ Increases server level

⚠️ REQUIREMENTS:
- Invite MUST be permanent (set to never expire)
- Invite MUST allow unlimited uses
- Do NOT delete invite during order

💡 Server Boost Benefits:
- Level 1 (2 boosts): +50 emoji slots, 128kbps audio
- Level 2 (7 boosts): +50 more emojis, 256kbps audio, server banner
- Level 3 (14 boosts): +100 more emojis, 384kbps audio, vanity URL`;
    }
    
    // Discord Members
    if (nameLower.includes('member') || nameLower.includes('join')) {
      const isOnline = nameLower.includes('online');
      const isOffline = nameLower.includes('offline');
      
      if (isOnline) {
        return `🟢 Discord Online Members Service

✅ Members appear ONLINE in your server
✅ Increases server activity appearance
✅ Real accounts

📝 HOW TO ORDER:
1. Create a PERMANENT invite link
2. Set invite to NEVER expire
3. Allow UNLIMITED uses

📝 Format:
https://discord.gg/yourcode

⚠️ REQUIREMENTS:
- Invite MUST be permanent
- Invite MUST be unlimited uses
- Do NOT delete invite during delivery`;
      }
      
      return `💬 Discord Members Service${isOffline ? ' (Offline)' : ''}

✅ Real Discord members
✅ Quality accounts
✅ Members stay in server

📝 HOW TO ORDER:
1. Go to your Discord server
2. Create an invite link
3. Set it to NEVER EXPIRE
4. Set to UNLIMITED USES
5. Copy and paste the link below

📝 Format:
https://discord.gg/yourcode

⚠️ IMPORTANT:
- Invite MUST be permanent (never expires)
- Invite MUST allow unlimited uses
- Do NOT kick members during delivery
- Do NOT delete the invite link`;
    }
    
    // Discord Friend Requests
    if (nameLower.includes('friend')) {
      return `👥 Discord Friend Requests Service

✅ Get friend requests on your account
✅ Real Discord users
✅ Fast delivery

📝 Format:
Enter your Discord username with discriminator.
Example: username#1234 or username

⚠️ REQUIREMENTS:
- Friend requests must be OPEN (not set to friends of friends only)
- Account must not be private
- Do not block incoming requests during delivery`;
    }
    
    // Default Discord
    return `💬 Discord Service

✅ Real Discord engagement
✅ Quality interactions
✅ Fast delivery

📝 Format:
Enter your Discord server invite link (must be permanent).
Example: https://discord.gg/yourcode

⚠️ Invite must be permanent and unlimited uses`;
  }
  
  // Snapchat services - expanded with specific types
  if (nameLower.includes('snapchat') || categoryLower.includes('snapchat')) {
    // Snapchat Followers
    if (nameLower.includes('follower') || nameLower.includes('subscriber')) {
      return `👻 Snapchat Followers Service

✅ Real Snapchat followers
✅ Quality profiles
✅ Organic growth

📝 HOW TO ORDER:
Enter your Snapchat USERNAME only (not link).

📝 Format:
yourusername

Example: john_doe123

⚠️ REQUIREMENTS:
- Account must be PUBLIC
- Do NOT change to private during delivery
- Username only, no @ symbol`;
    }
    
    // Snapchat Story Views
    if (nameLower.includes('view') || nameLower.includes('story')) {
      return `👁 Snapchat Story Views Service

✅ Get views on your Snapchat stories
✅ Real viewers
✅ Fast delivery

📝 HOW TO ORDER:
Enter your Snapchat USERNAME only.

📝 Format:
yourusername

⚠️ REQUIREMENTS:
- Story must be PUBLIC (viewable by everyone)
- Account must not be private
- Order while story is still active`;
    }
    
    // Snapchat Score
    if (nameLower.includes('score') || nameLower.includes('snap score')) {
      return `📊 Snapchat Score Service

✅ Increase your Snap Score
✅ Safe and gradual
✅ Permanent increase

📝 HOW TO ORDER:
1. Make sure your account can receive snaps from everyone
2. Enter your username below

📝 Format:
yourusername

⚠️ REQUIREMENTS:
- Account must be able to receive snaps from EVERYONE
- Go to Settings > Who Can > Contact Me > Everyone
- Do NOT change settings during delivery`;
    }
    
    // Snapchat Spotlight Views
    if (nameLower.includes('spotlight')) {
      return `✨ Snapchat Spotlight Views Service

✅ Get views on your Spotlight videos
✅ Increase visibility
✅ Boost engagement

📝 Format:
Enter your Snapchat Spotlight video link.

⚠️ Video must be PUBLIC and posted to Spotlight`;
    }
    
    // Default Snapchat
    return `👻 Snapchat Service

✅ Quality Snapchat engagement
✅ Real profiles
✅ Fast delivery

📝 Format:
Enter your Snapchat username (no @ symbol).
Example: yourusername

⚠️ Account must be public`;
  }
  
  // Twitch services
  if (nameLower.includes('twitch') || categoryLower.includes('twitch')) {
    if (nameLower.includes('follower')) {
      return `🎮 Twitch Followers Service

✅ Real Twitch followers
✅ Quality accounts
✅ No password required

📝 Format:
Enter your Twitch channel URL or username.
Example: https://twitch.tv/yourchannel

⚠️ Channel must be public.`;
    }
    if (nameLower.includes('viewer') || nameLower.includes('live')) {
      return `🔴 Twitch Live Viewers Service

✅ Real-time live viewers
✅ Boost your stream visibility
✅ Concurrent viewers

📝 Format:
Enter your Twitch channel URL when you go live.
Example: https://twitch.tv/yourchannel

⚠️ Start order AFTER you go live.`;
    }
    // Default Twitch
    return `🎮 Twitch Service

✅ Quality Twitch engagement
✅ Real interactions
✅ Fast delivery

📝 Format:
Enter your Twitch channel URL.
Example: https://twitch.tv/yourchannel

⚠️ Channel must be public.`;
  }
  
  // LinkedIn services
  if (nameLower.includes('linkedin') || categoryLower.includes('linkedin')) {
    if (nameLower.includes('follower') || nameLower.includes('connection')) {
      return `💼 LinkedIn Followers/Connections Service

✅ Professional profiles
✅ Quality engagement
✅ Boost credibility

📝 Format:
Enter your LinkedIn profile or company page URL.
Example: https://linkedin.com/in/yourprofile

⚠️ Profile must be public.`;
    }
    if (nameLower.includes('like') || nameLower.includes('reaction')) {
      return `👍 LinkedIn Likes/Reactions Service

✅ Boost post engagement
✅ Professional appearance
✅ Fast delivery

📝 Format:
Enter your LinkedIn post URL.
Example: https://linkedin.com/posts/yourpost

⚠️ Post must be public.`;
    }
    // Default LinkedIn
    return `💼 LinkedIn Service

✅ Professional engagement
✅ Quality interactions
✅ Boost your profile

📝 Format:
Enter your LinkedIn URL.
Example: https://linkedin.com/in/yourprofile

⚠️ Profile/Post must be public.`;
  }
  
  // Pinterest services
  if (nameLower.includes('pinterest') || categoryLower.includes('pinterest')) {
    if (nameLower.includes('follower')) {
      return `📌 Pinterest Followers Service

✅ Real Pinterest followers
✅ Quality accounts
✅ Boost your profile

📝 Format:
Enter your Pinterest profile URL.
Example: https://pinterest.com/yourusername

⚠️ Profile must be public.`;
    }
    if (nameLower.includes('repin') || nameLower.includes('save')) {
      return `🔄 Pinterest Repins/Saves Service

✅ Increase pin visibility
✅ Real engagement
✅ Boost reach

📝 Format:
Enter your Pinterest pin URL.
Example: https://pinterest.com/pin/123456

⚠️ Pin must be public.`;
    }
    // Default Pinterest
    return `📌 Pinterest Service

✅ Quality Pinterest engagement
✅ Real users
✅ Fast delivery

📝 Format:
Enter your Pinterest URL.
Example: https://pinterest.com/yourusername

⚠️ Content must be public.`;
  }
  
  // DM/Direct Message services
  if (nameLower.includes(' dm ') || nameLower.includes('direct message') || nameLower.includes('dm service')) {
    return `📩 Direct Message (DM) Service

✅ Reach users directly via DM
✅ Custom message content
✅ Targeted audience

📝 Format:
Provide target username/URL and your message.

⚠️ No spam, offensive or promotional content that violates platform terms.`;
  }
  
  // Mention/Tag services
  if (nameLower.includes('mention') || nameLower.includes('tag')) {
    return `🏷 Mention/Tag Service

✅ Get mentioned or tagged in posts
✅ Increase visibility and engagement
✅ Real accounts

📝 Format:
Enter the post URL where you want mentions/tags.

⚠️ Content must be public and comply with platform guidelines.`;
  }
  
  // Poll vote services
  if (nameLower.includes('poll') || nameLower.includes('vote')) {
    return `🗳 Poll Vote Service

✅ Get votes on your polls
✅ Fast delivery
✅ Real engagement

📝 Format:
Enter the poll URL and specify which option to vote for.
Example: https://platform.com/poll/123 | Option 1

⚠️ Poll must be public and accessible.`;
  }
  
  // Review services
  if (nameLower.includes('review')) {
    return `⭐ Review Service

✅ Get authentic-looking reviews
✅ Custom review text (if applicable)
✅ Boost your reputation

📝 Format:
Enter your business/product page URL.

⚠️ Content must comply with platform guidelines. No fake or misleading information.`;
  }
  
  // Live/Stream services
  if (nameLower.includes('live') || nameLower.includes('stream') || nameLower.includes('viewer')) {
    return `🔴 Live Stream Viewers Service

✅ Real-time live viewers
✅ Boost your live stream engagement
✅ Works on most platforms

📝 Format:
Enter your live stream URL when you go live.

⚠️ Stream must be public and active when order is placed.`;
  }
  
  // Story views
  if (nameLower.includes('story') && nameLower.includes('view')) {
    return `👁 Story Views Service

✅ Increase your story visibility
✅ Fast delivery
✅ Real engagement

📝 Format:
Enter your profile URL. Make sure your stories are public.

⚠️ Stories must be visible to everyone.`;
  }
  
  // Sign up services
  if (nameLower.includes('sign up') || nameLower.includes('signup') || nameLower.includes('registration')) {
    return `📝 Sign Up Service

✅ Get real sign-ups to your website/app
✅ Targeted demographics available
✅ Quality verified accounts

📝 Format:
Enter your website/app registration URL.
Provide any specific instructions if needed.

⚠️ Registration process must be straightforward.`;
  }
  
  // Music streaming services (Spotify, Boomplay, Audiomack)
  if (nameLower.includes('stream') && (nameLower.includes('music') || categoryLower.includes('spotify') || categoryLower.includes('boomplay') || categoryLower.includes('audiomack'))) {
    return `🎵 Music Streaming Service

✅ Real plays on your tracks
✅ Boost your streaming numbers
✅ Algorithmic boost potential

📝 Format:
Enter your track/album/playlist URL.
Example: https://open.spotify.com/track/xxx

⚠️ Track must be publicly available.`;
  }
  
  // Discord services
  if (nameLower.includes('discord') || categoryLower.includes('discord')) {
    return `💬 Discord Service

✅ Real Discord engagement
✅ Quality members/interactions
✅ Fast delivery

📝 Format:
Enter your Discord server invite link.
Example: https://discord.gg/xxx

⚠️ Server must be public and invite link must be valid.`;
  }
  
  // Default description for other services
  let description = '';
  
  // Platform detection
  const platforms: { [key: string]: string } = {
    'instagram': 'Instagram',
    'tiktok': 'TikTok',
    'facebook': 'Facebook',
    'youtube': 'YouTube',
    'twitter': 'Twitter/X',
    'spotify': 'Spotify',
    'telegram': 'Telegram',
    'linkedin': 'LinkedIn',
    'pinterest': 'Pinterest',
    'snapchat': 'Snapchat',
    'twitch': 'Twitch',
    'discord': 'Discord',
    'soundcloud': 'SoundCloud',
    'threads': 'Threads',
    'whatsapp': 'WhatsApp',
    'boomplay': 'Boomplay',
    'audiomack': 'Audiomack',
  };
  
  let platform = '';
  for (const [key, value] of Object.entries(platforms)) {
    if (nameLower.includes(key) || categoryLower.includes(key)) {
      platform = value;
      break;
    }
  }
  
  // Service type detection
  const serviceTypes: { [key: string]: string } = {
    'followers': 'Increase your follower count with high-quality followers.',
    'likes': 'Boost engagement with authentic likes on your content.',
    'views': 'Increase visibility with real views on your content.',
    'comments': 'Enhance engagement with relevant comments.',
    'shares': 'Expand your reach with shares and reposts.',
    'subscribers': 'Grow your subscriber base organically.',
    'plays': 'Increase play count for your tracks or videos.',
    'saves': 'Boost saves to improve algorithm ranking.',
    'impressions': 'Increase impressions for better visibility.',
    'reach': 'Expand your content reach to new audiences.',
    'members': 'Grow your group or channel membership.',
    'reactions': 'Get more reactions on your posts.',
    'reposts': 'Increase reposts for wider distribution.',
    'favorites': 'Get more favorites on your content.',
  };
  
  let serviceType = '';
  for (const [key, value] of Object.entries(serviceTypes)) {
    if (nameLower.includes(key)) {
      serviceType = value;
      break;
    }
  }
  
  // Quality indicators
  const qualityIndicators: string[] = [];
  if (nameLower.includes('hq') || nameLower.includes('high quality')) qualityIndicators.push('High Quality');
  if (nameLower.includes('real')) qualityIndicators.push('Real Users');
  if (nameLower.includes('premium')) qualityIndicators.push('Premium');
  if (nameLower.includes('instant')) qualityIndicators.push('Instant Start');
  if (nameLower.includes('fast')) qualityIndicators.push('Fast Delivery');
  if (nameLower.includes('lifetime') || nameLower.includes('non drop')) qualityIndicators.push('Lifetime Guarantee');
  if (nameLower.includes('refill')) qualityIndicators.push('Refill Included');
  if (nameLower.includes('no drop')) qualityIndicators.push('No Drop');
  if (nameLower.includes('organic')) qualityIndicators.push('Organic Growth');
  if (nameLower.includes('active')) qualityIndicators.push('Active Users');
  
  // Country detection
  const countries: { [key: string]: string } = {
    'usa': 'USA',
    'uk': 'UK',
    'nigeria': 'Nigeria',
    'nigerian': 'Nigeria',
    'worldwide': 'Worldwide',
    'global': 'Global',
    'brazil': 'Brazil',
    'india': 'India',
    'arab': 'Arab Region',
    'turkey': 'Turkey',
    'germany': 'Germany',
    'france': 'France',
    'canada': 'Canada',
    'australia': 'Australia',
    'russia': 'Russia',
    'spain': 'Spain',
    'italy': 'Italy',
    'mexico': 'Mexico',
    'indonesia': 'Indonesia',
    'japan': 'Japan',
    'korea': 'Korea',
    'europe': 'Europe',
  };
  
  let country = '';
  for (const [key, value] of Object.entries(countries)) {
    if (nameLower.includes(key)) {
      country = value;
      break;
    }
  }
  
  // Build description
  if (platform && serviceType) {
    description = `${platform} service. ${serviceType}`;
  } else if (serviceType) {
    description = serviceType;
  } else if (platform) {
    description = `${platform} growth service.`;
  } else {
    description = 'Social media marketing service.';
  }
  
  // Add quality indicators
  if (qualityIndicators.length > 0) {
    description += ` ${qualityIndicators.slice(0, 3).join(' • ')}.`;
  }
  
  // Add country targeting
  if (country) {
    description += ` Targeted: ${country}.`;
  }
  
  // Add order limits
  description += ` Order range: ${min} - ${max}.`;
  
  return description;
}

// Clean service names by removing provider references
function cleanServiceName(name: string): string {
  // Remove provider names from service names
  return name
    .replace(/\bOwlet\b/gi, 'QuickFollowers')
    .replace(/\bFollowspanel\b/gi, 'QuickFollowers')
    .replace(/\bOwlet's\b/gi, "QuickFollowers'")
    .replace(/\bFollowspanel's\b/gi, "QuickFollowers'");
}

function normalizeProviderDescription(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const cleaned = raw
    .replace(/\r\n/g, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned) return null;
  return cleanServiceName(cleaned);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Define providers
    const providers: Provider[] = [
      {
        name: 'owlet',
        url: 'https://therealowlet.com/api/v2',
        apiKey: Deno.env.get('OWLET_API_KEY') || '',
      },
      {
        name: 'followspanel',
        url: 'https://followspanel.com/api/v2',
        apiKey: Deno.env.get('FOLLOWSPANEL_API_KEY') || '',
      },
    ];

    // Validate API keys
    for (const provider of providers) {
      if (!provider.apiKey) {
        console.error(`${provider.name} API key not configured`);
      }
    }

    let allServicesData: any[] = [];
    const providerResults: { [key: string]: number } = {};

    // Fetch services from each provider with retries and delays to avoid rate limiting
    for (const provider of providers) {
      if (!provider.apiKey) {
        console.log(`Skipping ${provider.name} - no API key`);
        providerResults[provider.name] = 0;
        continue;
      }

      console.log(`Fetching services from ${provider.name}...`);
      
      let services: SMMService[] = [];
      let retries = 5; // Increased retries
      let lastError = '';
      
      while (retries > 0) {
        try {
          // Add delay between retries to avoid rate limiting
          if (retries < 5) {
            const delay = (5 - retries) * 2000; // 2s, 4s, 6s, 8s delays
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(r => setTimeout(r, delay));
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

          const response = await fetch(provider.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key: provider.apiKey,
              action: 'services',
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            lastError = `API request failed: ${response.status} ${response.statusText}`;
            console.error(`${provider.name} ${lastError}`);
            retries--;
            continue;
          }

          const responseData = await response.json();
          
          // Check if response is an error object
          if (responseData && typeof responseData === 'object' && 'error' in responseData) {
            lastError = `API returned error: ${responseData.error}`;
            console.error(`${provider.name} ${lastError}`);
            retries--;
            continue;
          }
          
          // Validate that we got an array of services
          if (!Array.isArray(responseData)) {
            lastError = `Unexpected response format: ${typeof responseData}`;
            console.error(`${provider.name} ${lastError}`);
            retries--;
            continue;
          }
          
          // Validate minimum service count to detect incomplete responses
          if (responseData.length < 10) {
            lastError = `Suspiciously low service count: ${responseData.length}`;
            console.warn(`${provider.name} ${lastError}`);
            retries--;
            continue;
          }
          
          services = responseData as SMMService[];
          console.log(`Successfully fetched ${services.length} services from ${provider.name}`);
          break;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            lastError = 'Request timed out after 30s';
          } else {
            lastError = error instanceof Error ? error.message : 'Unknown error';
          }
          console.error(`Error fetching from ${provider.name}:`, lastError);
          retries--;
        }
      }

      if (services.length === 0 && lastError) {
        console.error(`Failed to fetch from ${provider.name} after all retries. Last error: ${lastError}`);
      }

      providerResults[provider.name] = services.length;

      // Transform services with provider info
      const providerServicesData = services.map((service) => {
        let rate = parseFloat(service.rate);
        if (rate > 1000000) {
          rate = rate / 100;
        }

        const providerDesc = normalizeProviderDescription(
          (service as any).desc ?? (service as any).description ?? (service as any).instructions,
        );

        return {
          id: `${provider.name}-${service.service}`,
          name: cleanServiceName(service.name),
          type: service.type,
          category: cleanServiceName(service.category),
          rate: rate,
          min_order: parseInt(service.min),
          max_order: parseInt(service.max),
          // Prefer provider supplied instructions/description when present
          description: providerDesc,
          provider: provider.name,
        };
      });

      allServicesData = allServicesData.concat(providerServicesData);
    }

    // Don't proceed with deletion if we got significantly fewer services than expected
    if (allServicesData.length === 0) {
      throw new Error('No services fetched from any provider');
    }

    console.log(`Total services fetched: ${allServicesData.length}`);
    console.log(`Provider breakdown:`, providerResults);

    // Create a Set of current service IDs for fast lookup
    const currentServiceIds = new Set(allServicesData.map(s => s.id));

    // Get ALL existing service IDs from database (handle pagination)
    let existingServiceIds: string[] = [];
    let hasMore = true;
    let offset = 0;
    const pageSize = 1000;

    while (hasMore) {
      const { data: existingServices, error: fetchError } = await supabaseClient
        .from('services')
        .select('id')
        .range(offset, offset + pageSize - 1);

      if (fetchError) {
        console.error('Error fetching existing services:', fetchError);
        throw fetchError;
      }

      if (existingServices && existingServices.length > 0) {
        existingServiceIds = existingServiceIds.concat(existingServices.map(s => s.id));
        offset += pageSize;
        hasMore = existingServices.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`Existing services in database: ${existingServiceIds.length}`);

    // Find services to delete (exist in DB but not in current fetch)
    const servicesToDelete = existingServiceIds.filter(id => !currentServiceIds.has(id));
    console.log(`Services to potentially delete: ${servicesToDelete.length}`);

    // Safety check: Don't delete more than 20% of existing services in one sync
    const maxDeletePercentage = 0.2;
    const maxDeletions = Math.floor(existingServiceIds.length * maxDeletePercentage);
    
    let deletedCount = 0;
    const skippedDeletions: string[] = [];

    if (servicesToDelete.length > maxDeletions && existingServiceIds.length > 100) {
      console.warn(`WARNING: Attempting to delete ${servicesToDelete.length} services (>${maxDeletePercentage * 100}% of ${existingServiceIds.length}). Limiting to ${maxDeletions} deletions for safety.`);
      
      for (const serviceId of servicesToDelete.slice(0, maxDeletions)) {
        const { error: delError } = await supabaseClient
          .from('services')
          .delete()
          .eq('id', serviceId);
        
        if (delError) {
          if (delError.code === '23503') {
            console.log(`Skipping delete for ${serviceId} - referenced by orders`);
            skippedDeletions.push(serviceId);
          } else {
            console.error(`Error deleting service ${serviceId}:`, delError);
          }
        } else {
          deletedCount++;
        }
      }
    } else {
      for (const serviceId of servicesToDelete) {
        const { error: delError } = await supabaseClient
          .from('services')
          .delete()
          .eq('id', serviceId);
        
        if (delError) {
          if (delError.code === '23503') {
            console.log(`Skipping delete for ${serviceId} - referenced by orders`);
            skippedDeletions.push(serviceId);
          } else {
            console.error(`Error deleting service ${serviceId}:`, delError);
          }
        } else {
          deletedCount++;
        }
      }
    }
    
    console.log(`Successfully deleted ${deletedCount} orphaned services`);
    if (skippedDeletions.length > 0) {
      console.log(`Skipped ${skippedDeletions.length} services due to foreign key constraints`);
    }

    // Get existing descriptions to preserve custom ones
    const existingDescriptions: { [key: string]: string } = {};
    let descOffset = 0;
    let hasMoreDesc = true;

    while (hasMoreDesc) {
      const { data: existingDesc, error: descError } = await supabaseClient
        .from('services')
        .select('id, description')
        .range(descOffset, descOffset + 999);

      if (descError) {
        console.error('Error fetching existing descriptions:', descError);
      } else if (existingDesc && existingDesc.length > 0) {
        for (const svc of existingDesc) {
          if (svc.description) {
            existingDescriptions[svc.id] = svc.description;
          }
        }
        descOffset += 1000;
        hasMoreDesc = existingDesc.length === 1000;
      } else {
        hasMoreDesc = false;
      }
    }

    console.log(`Fetched ${Object.keys(existingDescriptions).length} existing descriptions`);

    // Helper function to check if description is custom/instructional
    const isCustomDescription = (desc: string): boolean => {
      if (!desc) return false;
      const customIndicators = [
        'Format:', 'URL:', 'URL |', 'Example:', 'Note:', 'Important:',
        'Enter your', 'Provide the', 'Link format:', 'link | keywords',
        'url | keyword', 'URL:keyword', 'Custom Comments'
      ];
      return customIndicators.some(indicator => desc.includes(indicator));
    };

    // Detect descriptions we generated (so we can replace them later with better/provider-specific instructions)
    const isAutoGeneratedDescription = (desc: string): boolean => {
      const markers = [
        '✅ Quality Telegram engagement',
        '✅ No password required',
        '💡 Benefits of Boosting:',
        '✅ Premium Telegram Boosts',
        '✅ Real Website Traffic Visitors',
        '📱 WhatsApp Contact Save Service',
      ];
      return markers.some(m => desc.includes(m));
    };

    // Fill in descriptions for all services
    for (const service of allServicesData) {
      // Prefer provider-provided descriptions (already set during fetch)
      if (typeof service.description === 'string' && service.description.trim().length > 0) {
        continue;
      }

      const existingDesc = existingDescriptions[service.id];

      // Keep existing custom descriptions only when provider didn't supply one,
      // but allow replacing our own previously auto-generated text.
      if (existingDesc && isCustomDescription(existingDesc) && !isAutoGeneratedDescription(existingDesc)) {
        service.description = cleanServiceName(existingDesc);
      } else {
        service.description = generateDescription(
          service.name,
          service.category,
          service.min_order.toString(),
          service.max_order.toString(),
        );
      }
    }

    // Upsert all current services
    const batchSize = 100;
    let successCount = 0;
    
    for (let i = 0; i < allServicesData.length; i += batchSize) {
      const batch = allServicesData.slice(i, i + batchSize);
      const { error } = await supabaseClient
        .from('services')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error('Error upserting batch:', error);
        throw error;
      }
      successCount += batch.length;
    }

    console.log(`Services synced successfully. Upserted ${successCount}, deleted ${deletedCount} services.`);

    // Check for significant changes and send notification
    const significantChangeThreshold = 50;
    const hasSignificantChanges = deletedCount > significantChangeThreshold || 
      Math.abs(allServicesData.length - existingServiceIds.length) > significantChangeThreshold;
    
    const hasProviderIssues = Object.entries(providerResults).some(([name, count]) => count === 0);
    
    if (hasSignificantChanges || hasProviderIssues) {
      const changes: string[] = [];
      
      if (hasProviderIssues) {
        const failedProviders = Object.entries(providerResults)
          .filter(([_, count]) => count === 0)
          .map(([name]) => name);
        changes.push(`<strong>Provider Issues:</strong> ${failedProviders.join(', ')} returned 0 services`);
      }
      
      if (deletedCount > significantChangeThreshold) {
        changes.push(`<strong>High Deletions:</strong> ${deletedCount} services were deleted`);
      }
      
      const netChange = allServicesData.length - existingServiceIds.length;
      if (Math.abs(netChange) > significantChangeThreshold) {
        changes.push(`<strong>Service Count Change:</strong> ${netChange > 0 ? '+' : ''}${netChange} (${existingServiceIds.length} → ${allServicesData.length})`);
      }
      
      changes.push(`<br><strong>Summary:</strong><br>• Upserted: ${successCount}<br>• Deleted: ${deletedCount}<br>• Owlet: ${providerResults['owlet'] || 0}<br>• FollowsPanel: ${providerResults['followspanel'] || 0}`);
      
      await sendSyncNotification(
        'Significant Sync Changes Detected',
        changes.join('<br><br>'),
        hasProviderIssues
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: allServicesData.length,
        deleted: deletedCount,
        skippedDeletions: skippedDeletions.length,
        providerResults,
        message: 'Services synced successfully from all providers'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error syncing services:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Send error notification
    await sendSyncNotification(
      'Service Sync Failed',
      `<strong>Error:</strong> ${errorMessage}<br><br>The automatic service synchronization has failed. Please check the edge function logs for more details and consider running a manual sync.`,
      true
    );
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
