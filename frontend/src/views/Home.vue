<template>
  <v-container>
    <v-row>
      <v-col cols="3">
        <sidebar-home></sidebar-home>
      </v-col>
      <v-col v-if="recentActivity" cols="9">
        <v-row>
          <v-col class="pt-0">
            <v-card class="pa-5" elevation="0" rounded="lg" color="background2">
              <v-subheader class="text-uppercase">Recent activity:</v-subheader>
              <v-chip-group
                v-model="selectedActivity"
                mandatory
                active-class="primary--text text--accent-1"
              >
                <v-chip class="ml-3 mb-3" small>all activity</v-chip>
                <v-chip class="mb-3" small>streams</v-chip>
                <v-chip class="mb-3" small>commits</v-chip>
              </v-chip-group>

              <div class="clear"></div>
            </v-card>
          </v-col>
        </v-row>

        <v-row>
          <v-col class="ml-0 pt-0">
            <div v-for="(activity, i) in recentActivity" :key="i">
              <feed-stream
                v-if="activity.__typename === 'Stream'"
                :stream="activity"
                :user="user"
              ></feed-stream>
              <feed-commit
                v-else-if="activity.__typename === 'CommitCollectionUserNode'"
                :commit="activity"
                :user="user"
              ></feed-commit>
            </div>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>
<script>
import SidebarHome from "../components/SidebarHome"
import FeedStream from "../components/FeedStream"
import FeedCommit from "../components/FeedCommit"
import userFeedQuery from "../graphql/userFeed.gql"

export default {
  name: "Home",
  components: { SidebarHome, FeedStream, FeedCommit },
  apollo: {
    user: {
      prefetch: true,
      query: userFeedQuery
    }
  },
  data: () => ({ selectedActivity: 0, user: {} }),
  computed: {
    recentActivity() {
      let activity = []
      let activityGrouped = []

      if (
        this.user.streams &&
        this.user.streams.items &&
        this.selectedActivity != 2
      ) {
        activity.push(...this.user.streams.items)
      }

      if (
        this.user.commits &&
        this.user.commits.items &&
        this.selectedActivity != 1
      ) {
        activity.push(...this.user.commits.items)
      }

      if (activity.length === 1) return activity

      activity.sort(this.compareUpdates)

      let group = []
      for (let i = 0; i < activity.length; i++) {
        //first item
        if (i === 0) {
          group.push(activity[i])
          continue
        }

        if (
          group[0].__typename === "CommitCollectionUserNode" &&
          group[0].streamId === activity[i].streamId
        ) {
          group.push(activity[i])
        } else {
          if (group.length > 1) {
            activityGrouped.push({
              streamName: group[0].streamName,
              streamId: group[0].streamId,
              createdAt: group[0].createdAt,
              message: group[0].message,
              __typename: "CommitCollectionUserNode",
              items: group
            })
          } else activityGrouped.push(...group)
          group = []
          group.push(activity[i])
        }

        // last item
        if (i == activity.length - 1) {
          if (group.length > 1) {
            activityGrouped.push({
              streamName: group[0].streamName,
              streamId: group[0].streamId,
              createdAt: group[0].createdAt,
              message: group[0].message,
              __typename: "CommitCollectionUserNode",
              items: group
            })
          } else activityGrouped.push(...group)
        }
      }

      return activityGrouped
    }
  },
  watch: {
    user(val) {
      console.log(val)
    }
  },
  methods: {
    compareUpdates(a, b) {
      if (a.createdAt < b.createdAt) {
        return 1
      }
      if (a.createdAt > b.createdAt) {
        return -1
      }
      return 0
    }
  }
}
</script>
