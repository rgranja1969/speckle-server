<template>
  <v-container>
    <v-row>
      <v-col cols="3">
        <sidebar-home></sidebar-home>
      </v-col>
      <v-col cols="9">
        <v-card rounded="lg" class="pa-5" elevation="0" color="background2">
          <v-card-title>Your Streams</v-card-title>
          <v-card-actions>
            <span class="ml-2">
              You have {{ streams.totalCount }} stream{{
              streams.totalCount == 1 ? `` : `s`
              }}
              in total.
            </span>
            <v-spacer></v-spacer>
            <v-btn class="ml-3 mt-5 text-right" color="primary" elevation="0" small @click="newStream">
              <v-icon small class="mr-1">mdi-plus-box-outline</v-icon>
              new stream
            </v-btn>
          </v-card-actions>
          <stream-dialog ref="streamDialog"></stream-dialog>
          <v-card-text v-if="streams && streams.items">
            <div v-for="(stream, i) in streams.items" :key="i">
              <list-item-stream :stream="stream"></list-item-stream>
              <v-divider v-if="i < streams.items.length - 1"></v-divider>
            </div>
            <infinite-loading @infinite="infiniteHandler" v-if="streams.items.length < streams.totalCount">
              <div slot="no-more">These are all your streams!</div>
              <div slot="no-results">There are no streams to load</div>
            </infinite-loading>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
<script>
import gql from "graphql-tag"
import ListItemStream from "../components/ListItemStream"
import SidebarHome from "../components/SidebarHome"
import StreamDialog from "../components/dialogs/StreamDialog"
import streamsQuery from "../graphql/streams.gql"
import InfiniteLoading from "vue-infinite-loading"

export default {
  name: "Streams",
  components: { ListItemStream, SidebarHome, StreamDialog, InfiniteLoading },
  apollo: {
    streams: {
      prefetch: true,
      query: streamsQuery,
      fetchPolicy: "cache-and-network" //https://www.apollographql.com/docs/react/data/queries/
    }
  },
  data: ( ) => ( {
    streams: [ ]
  } ),
  computed: {},
  watch: {},
  methods: {
    infiniteHandler( $state ) {
      this.$apollo.queries.streams.fetchMore( {
        variables: {
          cursor: this.streams.cursor
        },
        // Transform the previous result with new data
        updateQuery: ( previousResult, { fetchMoreResult } ) => {
          console.log( fetchMoreResult )
          const newItems = fetchMoreResult.streams.items

          //set vue-infinite state
          if ( newItems.length === 0 ) $state.complete( )
          else $state.loaded( )

          return {
            streams: {
              __typename: previousResult.streams.__typename,
              totalCount: fetchMoreResult.streams.totalCount,
              cursor: fetchMoreResult.streams.cursor,
              // Merging the new streams
              items: [ ...previousResult.streams.items, ...newItems ]
            }
          }
        }
      } )
    },

    newStream( ) {
      this.$refs.streamDialog.open( ).then( ( dialog ) => {
        if ( !dialog.result ) return
        console.log( dialog )
        this.$apollo
          .mutate( {
            mutation: gql `
              mutation streamCreate($myStream: StreamCreateInput!) {
                streamCreate(stream: $myStream)
              }
            `,
            variables: {
              myStream: {
                name: dialog.stream.name,
                description: dialog.stream.description,
                isPublic: dialog.stream.isPublic
              }
            }
          } )
          .then( ( data ) => {
            // Result
            console.log( data )

            this.$apollo.queries.streams.refetch( )
          } )
          .catch( ( error ) => {
            // Error
            console.error( error )
          } )
      } )
    }
  },
  mounted( ) {
    console.log(this.$route)
    this.$matomo && this.$matomo.trackPageView( "streams" )
  }
}

</script>
<style></style>
