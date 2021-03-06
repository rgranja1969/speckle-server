<template>
  <div>
    <v-card
      elevation="0"
      rounded="lg"
      class="pa-4 text-center"
      style="position: relative"
      color="background2"
    >
      <v-card-title class="justify-center pb-0">
        <v-avatar color="background" size="64">
          <v-img v-if="user.avatar" :src="user.avatar" />
          <v-img
            v-else
            :src="`https://robohash.org/` + user.id + `.png?size=64x64`"
          />
        </v-avatar>
      </v-card-title>
      <v-card-title class="justify-center">
        {{ user.name }}
      </v-card-title>
      <v-card-text>
        <p class="subtitle-1">{{ user.company }}</p>
        <p>
          {{ user.bio }}
        </p>
        <span class="streamid">{{ user.id }}</span>
      </v-card-text>
      <v-btn
        v-tooltip="'Edit profile'"
        small
        icon
        style="position: absolute; right: 15px; top: 15px"
        @click="editUser"
      >
        <v-icon small>mdi-pencil-outline</v-icon>
      </v-btn>

      <user-dialog ref="editUserDialog"></user-dialog>
    </v-card>

    <v-card
      rounded="lg"
      class="mt-5 pa-4 text-center"
      style="position: relative"
      elevation="0"
      color="background2"
    >
      <v-card-title class="justify-center text-wrap">
        {{ serverInfo.name }}
      </v-card-title>
      <v-card-text>
        <p class="subtitle-1">{{ serverInfo.company }}</p>
        <p>{{ serverInfo.description }}</p>
        <p v-if="serverInfo.adminContact">
          Contact: {{ serverInfo.adminContact }}
        </p>
        <code v-if="serverInfo.canonicalUrl">
          {{ serverInfo.canonicalUrl }}
        </code>
      </v-card-text>
      <v-btn
        v-if="user.role === `server:admin`"
        v-tooltip="'Edit server information'"
        small
        icon
        style="position: absolute; right: 15px; top: 15px"
        @click="editServer"
      >
        <v-icon small>mdi-pencil-outline</v-icon>
      </v-btn>

      <server-dialog ref="editServerDialog"></server-dialog>
    </v-card>
  </div>
</template>
<script>
import userQuery from "../graphql/user.gql"
import serverQuery from "../graphql/server.gql"
import gql from "graphql-tag"
import UserDialog from "../components/dialogs/UserDialog"
import ServerDialog from "../components/dialogs/ServerDialog"

export default {
  components: { UserDialog, ServerDialog },
  data: () => ({ user: {}, serverInfo: {} }),
  apollo: {
    user: {
      prefetch: true,
      query: userQuery
    },
    serverInfo: {
      prefetch: true,
      query: serverQuery
    }
  },
  methods: {
    editUser() {
      this.$refs.editUserDialog.open(this.user).then((dialog) => {
        if (!dialog.result) return
        console.log(dialog)
        this.$apollo
          .mutate({
            mutation: gql`
              mutation userUpdate($myUser: UserUpdateInput!) {
                userUpdate(user: $myUser)
              }
            `,
            variables: {
              myUser: { ...dialog.user }
            }
          })
          .then((data) => {
            this.$apollo.queries.user.refetch()
          })
          .catch((error) => {
            // Error
            console.error(error)
          })
      })
    },
    editServer() {
      this.$refs.editServerDialog.open(this.serverInfo).then((dialog) => {
        if (!dialog.result) return
        console.log(dialog)
        this.$apollo
          .mutate({
            mutation: gql`
              mutation serverInfoUpdate($myServerInfo: ServerInfoUpdateInput!) {
                serverInfoUpdate(info: $myServerInfo)
              }
            `,
            variables: {
              myServerInfo: { ...dialog.server }
            }
          })
          .then((data) => {
            this.$apollo.queries.serverInfo.refetch()
          })
          .catch((error) => {
            // Error
            console.error(error)
          })
      })
    }
  }
}
</script>
